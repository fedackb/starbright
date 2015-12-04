import webapp2
import handlers


# Specify configuration options.
app_config = {
    'location_group_id': '*locations*',
    'sample_group_id': '*samples*'
}


# Specify URL routes.
routes = [
    (r'/v1/Locations$', handlers.Locations),
    (r'/v1/Locations/[0-9]+/SQsamples$', handlers.LocationSamples),
    (r'/v1/SQsamples$', handlers.Samples),
    (r'/v1/SQsamples/[0-9]+$', handlers.Samples),
    (r'/.*', handlers.Default)
]


# Create a WSGI-compliant Python web app.
app = webapp2.WSGIApplication(routes, debug = True, config = app_config)
