/**
 * @author Brett Fedack
 */

/**
 * Sends an asynchronous request to retrieve this user's geographic location
 * @param {function} successHandler - Function to invoke if requests succeeds
 * @param {Element=} opt_log - DOM element to serve as error log (Optional)
 */
function getLatLong(successHandler, opt_log) {
	/* Return early if geolocation service is unavailable. */
	if (!'geolocation' in navigator) {
		opt_log.style.display = 'block';
		opt_log.innerHTML = 'Geolocation services are unavailabe';
	}

	/**
	 * Indicates that the requested coordinates could not be retrieved
	 * @param {Position} position - Position object passed by async request
	 */
	function handleError(position) {
		opt_log.style.display = 'block';
		opt_log.innerHTML = 'Unable to retrieve geolocation';
	}

	/* Attempt to retrieve latitude and longitude. */
	navigator.geolocation.getCurrentPosition(successHandler, handleError);
}

/**
 * Sends an asynchronous request
 * @param {string} method - HTTP action verb
 * @param {string} url - Location of the server
 * @param {function=} opt_successHandler - Function to invoke if request succeeds
 *     (optional)
 * @param {Element=} opt_log - DOM element to serve as error opt_log
 *     (optional)
 * @param {Object<string,string>=} opt_headers - Header name-value pairs
 *     (optional)
 * @param {Object<string,string>=} opt_data - Data name-values pairs
 *     (optional)
 * @param {Object<string,string>=} opt_params - Query name-value pairs
 *     (optional)
 */
function ajax(method, url,
              opt_successHandler, opt_log, opt_headers, opt_data, opt_params) {
	/* Create and AJAX request. */
	req = new XMLHttpRequest();
	if (!req && opt_log) {
		opt_log.style.display = 'block';
		opt_log.innerHTML = 'Unable to create request';
	}

	/* Append HTTP query string to url. */
	if (opt_params) {
		url += '?'
		for (name of Object.keys(opt_params)) {
			url += encodeURIComponent(name);
			url += '=';
			url += encodeURIComponent(opt_params[name]);
			url += '&';
		}
		url = url.slice(0, url.length - 1); /* Remove trailing '&'. */
	}

	/* Prepare to send the request. */
	req.open(method, url, true);

	/* Define request headers. */
	if (opt_headers) {
		for (name of Object.keys(opt_headers)) {
			req.setRequestHeader(name, opt_headers[name]);
		}
	}

	/* Define request data. */
	var data = '';
	if (opt_data) {
		req.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
		var encodedName, encodedValue;
		for (name of Object.keys(opt_data)) {
			data += encodeURIComponent(name);
			data += '=';
			data += encodeURIComponent(opt_data[name]);
			data += '&';
		}
		data = data.slice(0, data.length - 1); /* Remove trailing '&'. */
	}

	/* Send the request. */
	req.send(data);

	/* Specify how to handle the request. */
	req.onreadystatechange = function() {
		if (this.readyState === 4) {

			/* Hand server's response off to given handler. */
			if (opt_successHandler && this.status === 200) {
				opt_successHandler(this.responseText);
			}

			/* Indicate that the request failed. */
			else if (opt_log) {
				opt_log.style.display = 'block';
				opt_log.innerHTML = 'Request to server failed';
			}
		}
	}
}
