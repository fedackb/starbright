import json
import math
import models
import webapp2
from google.appengine.ext import ndb
from google.appengine.api import users


class Default(webapp2.RequestHandler):
    def __init__(self, request, response):
        self.initialize(request, response)

        # Determine if client accepts JSON data.
        self.client_accepts_JSON = 'application/json' in self.request.accept

        # Create ancestor groups for locations and sky quality samples.
        self.locations_key = ndb.Key(models.Location, self.app.config.get('location_group_id'))
        self.samples_key = ndb.Key(models.SQsample, self.app.config.get('sample_group_id'))


    def get(self):
        ''' Abstract method for GET HTTP verb; generates error by default '''
        self.respond(400, message = 'Unrecognized API call')


    def post(self):
        ''' Abstract method for POST HTTP verb; generates error by default '''
        self.respond(400, message = 'Unrecognized API call')


    def put(self):
        ''' Abstract method for PUT HTTP verb; generates error by default '''
        self.respond(400, message = 'Unrecognized API call')


    def delete(self):
        ''' Abstract method for DELETE HTTP verb; generates error by default '''
        self.respond(400, message = 'Unrecognized API call')


    def respond(self, status_code = 200, message = '', data = dict()):
        ''' Generates a response according to the given information '''
        status_map = {
            200: 'OK',
            400: 'Bad Request',
            401: 'Unauthorized',
            403: 'Forbidden',
            406: 'Not Acceptable',
            500: 'Internal Server Error'
        }

        # Indicate status.
        self.response.status_int = status_code
        if status_code != 200:
            self.response.has_error()
        if status_code in status_map:
            self.response.status_message = status_map[status_code]

        # Format response type.
        self.response.headers['Access-Control-Allow-Origin'] = '*'
        self.response.headers['Access-Control-Allow-Headers'] = 'Origin, Content-Type, Accept'
        self.response.headers['Access-Control-Allow-Methods'] = 'POST, GET, PUT, DELETE'
        self.response.headers['Content-Type'] = 'application/json'

        # Send response.
        if message:
            data['message'] = message
        if data:
            self.response.write(json.dumps(data))


class Locations(Default):
    @staticmethod
    def distance_on_unit_sphere(lat1, long1, lat2, long2):
        '''
        Calculates the normalized distance between points on a sphere

        Source:
            http://www.johndcook.com/blog/python_longitude_latitude/ (Public Domain)
        '''
        degrees_to_radians = math.pi / 180.0
        phi1 = (90.0 - lat1) * degrees_to_radians
        phi2 = (90.0 - lat2) * degrees_to_radians
        theta1 = long1 * degrees_to_radians
        theta2 = long2 * degrees_to_radians
        cos = (math.sin(phi1) * math.sin(phi2) * math.cos(theta1 - theta2) +
               math.cos(phi1) * math.cos(phi2))
        arc = math.acos(cos)
        return arc


    def get(self):
        # Return early if the client doesn't accept JSON.
        if not self.client_accepts_JSON:
            self.respond(406, message = 'API only supports JSON responses')
            return

        # Retrieve get data.
        get_data = {i: self.request.get(i) for i in self.request.arguments()}

        # Check for missing post data.
        if 'lat' not in get_data or 'lon' not in get_data or 'dist' not in get_data:
            self.respond(400, message = 'Latitude (lat), longitude (lon), and distant (dist) must be specified')
            return

        # Check coordinate bounds.
        lat = float(get_data['lat'])
        lat = float('{0:.2f}'.format(lat))
        lon = float(get_data['lon'])
        lon = float('{0:.2f}'.format(lon))
        if not (lat >= -90 and lat <= 90 and lon > -180 and lon <= 180):
            self.respond(400, message = 'Latitude and longitude must be in the ranges [-90, 90] and (-180, 180], respectively')
            return

        # Check distance bounds.
        dist = float(get_data['dist'])
        if not (dist >= 5 and dist <= 12500):
            self.respond(400, message = 'Distance must be in the range [5, 2500] miles')
            return

        # Sort locations with the given distance by sky brightness.
        results = models.Location.sorted_by_mpas(ancestor = self.locations_key)
        results = [{
                'lat': item[0],
                'lon': item[1],
                'mpas_avg': '{0:.2f}'.format(item[2]),
                'dist': '{0:.2f}'.format(
                    self.distance_on_unit_sphere(lat, lon, float(item[0]), float(item[1])) * 3959
                ),
            }
            for item in results
        ]
        results = [item for item in results if float(item['dist']) < dist]

        # Return a JSON version of the search results.
        self.respond(data = results)


    def post(self):
        # Return early if the client doesn't accept JSON.
        if not self.client_accepts_JSON:
            self.respond(406, message = 'API only supports JSON responses')
            return

        # Retrieve post data.
        post_data = {i: self.request.get(i) for i in self.request.arguments()}

        # Check for missing post data.
        if 'lat' not in post_data or 'lon' not in post_data:
            self.respond(400, message = 'Both latitude (lat) and longitude (lon) must be specified')
            return

        # Check coordinate bounds.
        lat = float(post_data['lat'])
        lon = float(post_data['lon'])
        if not (lat >= -90 and lat <= 90 and lon > -180 and lon <= 180):
            self.respond(400, message = 'Latitude and longitude must be in the ranges [-90, 90] and (-180, 180], respectively')
            return

        # Determine if the location already exists in the datastore.
        loc = models.Location.from_co(lat, lon, ancestor = self.locations_key)

        # Create a new location at the given coordinates.
        if not loc:
            loc = models.Location(co = ndb.GeoPt(lat, lon), parent = self.locations_key)
        loc.put()

        # Return a JSON version of the new location.
        self.respond(data = loc.to_dict())


class LocationSamples(Default):
    def post(self):
        # Return early if the client doesn't accept JSON.
        if not self.client_accepts_JSON:
            self.respond(406, message = 'API only supports JSON responses')
            return

        # Retrieve post data.
        post_data = {i: self.request.get(i) for i in self.request.arguments()}

        # Check for missing post data.
        if 'mpas' not in post_data:
            self.respond(400, message = 'Sky quality (mpas) must be specified')
            return

        # Check sky quality measurement bounds.
        mpas = float(post_data['mpas'])
        if mpas < 12 or mpas > 21:
            self.respond(400, message = 'Sky quality (mpas) must be in range [12, 21]')
            return

        # Determine if given location exists.
        loc_id = int(self.request.path.split('/')[3])
        loc = models.Location.from_id(id = loc_id, ancestor = self.locations_key)
        if not loc:
            self.respond(400, message = 'Given location does not exist in datastore')
            return

        # Create a sky quality sample.
        user_id = users.get_current_user().user_id() if users.get_current_user() else ''
        sample = models.SQsample(
            mpas = mpas,
            user_id = user_id,
            parent = self.samples_key
        )
        sample.put()

        # Associate created sample with the given location.
        loc.samples.append(sample.key)
        loc.put()

        # Return a JSON version of the new sky quality sample.
        self.respond(data = sample.to_dict())


class Samples(Default):
    def get(self):
        # Return early if the client doesn't accept JSON.
        if not self.client_accepts_JSON:
            self.respond(406, message = 'API only supports JSON responses')
            return

        # Restrict access to authorized users.
        user = users.get_current_user()
        if not user:
            self.reponse(401, messsage = 'Access to sample data is restricted to logged in users')

        # Retrieve a list of sky quality samples submitted by the current user.
        results = models.SQsample.from_user(ancestor = self.samples_key)

        # Return a JSON version of the search results.
        self.respond(data = results)


    def delete(self):
        # Return early if the client doesn't accept JSON.
        if not self.client_accepts_JSON:
            self.respond(406, message = 'API only supports JSON responses')
            return

        # Determine if given sky quality sample exists.
        sample_id = int(self.request.path.split('/')[3])
        sample = models.SQsample.from_id(id = sample_id, ancestor = self.samples_key)
        if not sample:
            self.respond(400, message = 'Given sky quality sample does not exist in Datastore')
            return

        # Determine if the current user is authorized to delete the sample.
        user = users.get_current_user()
        if sample.user_id and (not user or user.user_id() != sample.user_id):
            self.reponse(401, messsage = 'Given sky quality sample belongs to a different user')
            return

        # Remove all associations with this sky quality sample.
        affected_locations = models.Location.delete_refs(sample_key = sample.key, ancestor = self.locations_key)

        # Delete given sky quality sample.
        sample.key.delete()

        # Respond with the list of locations affected by the deletion.
        self.respond(data = {'affected_locations': affected_locations})


    def put(self):
        # Return early if the client doesn't accept JSON.
        if not self.client_accepts_JSON:
            self.respond(406, message = 'API only supports JSON responses')
            return

        # Retrieve put data.
        put_data = {i: self.request.get(i) for i in self.request.arguments()}

        # Check for missing put data.
        if 'mpas' not in put_data:
            self.respond(400, message = 'Sky quality (mpas) must be specified')
            return

        # Check sky quality measurement bounds.
        mpas = float(put_data['mpas'])
        if mpas < 12 or mpas > 21:
            self.respond(400, message = 'Sky quality (mpas) must be in range [12, 21]')
            return

        # Determine if given sky quality sample exists.
        sample_id = int(self.request.path.split('/')[3])
        sample = models.SQsample.from_id(id = sample_id, ancestor = self.samples_key)
        if not sample:
            self.respond(400, message = 'Given sky quality sample does not exist in Datastore')
            return

        # Determine if the current user is authorized to delete the sample.
        user = users.get_current_user()
        if sample.user_id and (not user or user.user_id() != sample.user_id):
            self.reponse(401, messsage = 'Given sky quality sample belongs to a different user')
            return

        # Update the given sky quality sample.
        sample.mpas = mpas
        sample.put()

        # Return a JSON version of the new sky quality sample.
        self.respond(data = sample.to_dict())
