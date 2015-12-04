import os
import webapp2
import jinja2
from google.appengine.api import users


class Default(webapp2.RequestHandler):
    def get(self):
        # Redirect any unrecognized URL to the home page.
        return webapp2.redirect('/')


class StarBright(webapp2.RequestHandler):
    def get(self):
        # Create a templating environment.
        env = jinja2.Environment(
            loader = jinja2.FileSystemLoader(os.path.dirname(__file__) + '/templates'),
            extensions = ['jinja2.ext.autoescape'],
            autoescape = True
        )

        # Build UI from a template.
        template = env.get_template('ui.html')
        template_args = {
            'user': users.get_current_user(),
            'login_url': users.create_login_url(self.request.uri),
            'logout_url': users.create_logout_url(self.request.uri)
        }
        page = template.render(template_args)

        # Send UI to the client.
        self.response.write(page)


# Specify URL routes.
routes = [
    (r'/', StarBright),
    (r'/.*', Default)
]


# Create a WSGI-compliant Python web app.
app = webapp2.WSGIApplication(routes, debug = True)
