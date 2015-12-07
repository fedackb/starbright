from operator import itemgetter
from google.appengine.ext import ndb
from google.appengine.api import users
from operator import attrgetter


class Location(ndb.Model):
    # Latitude, Longitude (degrees)
    co = ndb.GeoPtProperty(required = True)


    # Relationship with Sky Quality Samples
    samples = ndb.KeyProperty(kind = 'SQsample', repeated = True)


    @classmethod
    def from_id(cls, id, ancestor = None):
        ''' Retrieves the identified location from the datastore '''
        location_list = cls.query(ancestor = ancestor).fetch()
        for location in location_list:
            if location.key.id() == id:
                return location
        return None


    @classmethod
    def from_co(cls, lat, lon, ancestor = None):
        ''' Retrieves location with matching coordinates from the datastore '''
        location_list = cls.query(ancestor = ancestor).fetch()
        for location in location_list:
            latitude = location.co.lat
            longitude = location.co .lon
            if lat == latitude and lon == longitude:
                return location
        return None


    @classmethod
    def sorted_by_mpas(cls, ancestor = None):
        ''' Retrieves a list of locations, sorted in descending mpas order '''
        location_list = cls.query(ancestor = ancestor).fetch()
        latlon_map = dict()
        for location in location_list:

            # Get the list of sky brightness.
            mpas_list = [key.get().mpas for key in location.samples if key.get()]
            samples = len(mpas_list)
            if samples < 1:
                continue

            # Extract the relevant data.
            mpas_avg = sum(mpas_list) / samples
            lat = location.co.lat
            lon = location.co.lon
            co = ('{0:.2f}'.format(lat), '{0:.2f}'.format(lon))

            # Add data to the coordinates map.
            if co in latlon_map:

                # Combine samples counts.
                prev_samples = latlon_map[co]['samples']
                new_samples = samples
                combined_samples = prev_samples + new_samples

                # Combine brightness measurements.
                prev_mpas_avg = latlon_map[co]['mpas_avg']
                new_mpas_avg = mpas_avg
                combined_mpas_avg = (
                    prev_mpas_avg * prev_samples / combined_samples +
                    new_mpas_avg * new_samples / combined_samples
                )

                # Update data.
                latlon_map[co]['samples'] = combined_samples
                latlon_map[co]['mpas_avg'] = combined_mpas_avg
            else:
                # Add new datum.
                latlon_map[co] = {
                    'samples': len(mpas_list),
                    'mpas_avg': mpas_avg
                }

        # Decompose coordinates map, and sort results.
        results = [(k[0], k[1], latlon_map[k]['mpas_avg']) for k in latlon_map]
        results = sorted(results, key = itemgetter(2))
        results.reverse()

        return results


    @classmethod
    def delete_refs(cls, sample_key, ancestor = None):
        ''' Lists locations that reference the given sky quality sample '''
        ret = []
        location_list = cls.query(ancestor = ancestor).fetch()
        for location in location_list:
            if sample_key in location.samples:
                location.samples.remove(sample_key)
                location.put()
                ret.append(location.key.id())
        return ret


    def has_ref(self, sample_key):
        ''' Determines if this location references the given sky quality sample '''
        return sample_key in self.samples


    def to_dict(self):
        ''' Returns a dictionary representation of this entity '''
        return {'id': self.key.id(), 'lat': self.co.lat, 'lon': self.co.lon}


class SQsample(ndb.Model):
    # Sky quality measurement (magnitudes per arcsecond squared)
    mpas = ndb.FloatProperty(required = True)


    # User who submitted the sky quality measurement
    user_id = ndb.StringProperty(default = '')


    # Date & Time of measurement (Python datetime object)
    timestamp = ndb.DateTimeProperty(auto_now_add = True)


    @classmethod
    def from_id(cls, id, ancestor = None):
        ''' Retrieves the identified sky quality sample from the Datastore '''
        sample_list = cls.query(ancestor = ancestor).fetch()
        for sample in sample_list:
            if sample.key.id() == id:
                return sample
        return None


    @classmethod
    def from_user(cls, ancestor = None):
        ''' Retrieves a list of samples submitted by the current user '''
        results = []

        # Determine the current user.
        user = users.get_current_user()

        # Return early if a user is not logged in.
        if not user:
            return results

        # Search for all samples submitted by the current user.
        user_id = user.user_id()
        results = [
            sample.to_dict()
            for sample in sorted(
                cls.query(ancestor = ancestor).fetch(),
                key = attrgetter('timestamp'),
                reverse = True
            )
            if sample.user_id == user_id
        ]

        return results


    def to_dict(self):
        ''' Returns a dictionary representation of this entity '''
        return {'id': self.key.id(), 'mpas': self.mpas, 'timestamp': self.timestamp.strftime('%Y-%m-%dT%H:%M:%SZ')}
