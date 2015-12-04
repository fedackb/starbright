/**
 * @author Brett Fedack
 */

// var url = 'http://localhost:8080/';
var url = 'http://cs496-f15-starbright.appspot.com/';

window.onload = init;

/**
 * Represents overlapping pages of the user interface
 * @constructor
 */
var Pages = function() {
	this.pageTrace = [];
	this.displayMap = {};
};

Pages.prototype = {
	constructor: Pages,

	/**
	 * Retrieves pages from the DOM and initializes the page trace
	 */
	init: function() {
		var pageList = document.getElementsByClassName('page');

		/* Store page display information. */
		for (var i = 0; i < pageList.length; i++) {
			var page = pageList[i];
			this.displayMap[page.id] = window.getComputedStyle(page).display;
		}

		/* Hide all but the last page. */
		for (var i = 0; i < pageList.length - 1; i++) {
			pageList[i].style.display = 'none';
		}

		/* Initialize the page trace. */
		if (pageList.length > 0) {
			this.pageTrace.push(pageList[pageList.length - 1]);
		}
	},

	/**
	 * Pushes the given page to the trace
	 * @param {Element} page - DOM element representing a page
	 */
	next: function(page) {
		/* Update the trace. */
		var curr = this.pageTrace[this.pageTrace.length - 1];
		this.pageTrace.push(page);

		/* Set display values accordingly. */
		page.style.display = this.displayMap[page.id];
		curr.style.display = 'none';
	},

	/**
	 * Backtrace the page stack
	 */
	back: function() {
		/* Update the trace. */
		var prev = this.pageTrace.pop();
		var curr = this.pageTrace[this.pageTrace.length - 1];

		/* Set display values accordingly. */
		curr.style.display = this.displayMap[curr.id];
		prev.style.display = 'none';
	}
};

var pages = new Pages();
var renderer = new Renderer();
var camera = new Camera();
var stars = new StarField(starPositions, starMagnitudes);

/**
 * Initializes the state of this application
 */
function init() {
	pages.init();
	var homePage = document.getElementById('home-page');
	var canvas = document.getElementById('webgl');
	var log = document.getElementById('sky-quality-feedback');
	renderer.init(canvas, log);
	setupHandlers();
}


/**
 * Removes any feedback messages from the UI
 */
function clearFeedback() {
	feedbackList = document.getElementsByClassName('feedback');
	for (var i = 0; i < feedbackList.length; i++) {
		feedbackList[i].style.display = 'none';
	}
}

/**
 * Determines if it is possible to run the sky quality visualization
 */
function preMeasure() {
	clearFeedback();

	/* Select a DOM element to serve as a container for any feedback. */
	var log = document.getElementById('sky-quality-feedback');
	log.style.display = 'none';

	/* Attempt to retrieve geolocation coordinates. */
	getLatLong(measure, log);
}

/**
 * Runs the sky quality visualization
 * @param {Position} position - Position object passed by async request
 */
function measure(position) {
	/* Orient the viewer according to latitude, longitude, date, and time. */
	var lat = position.coords.latitude;
	var lon = position.coords.longitude;
	camera.relocate(lat, lon);

	/* Display to the visualization page. */
	var measurePage = document.getElementById('measure-page');
	pages.next(measurePage);

	/* Draw the scene. */
	var mpasInput = document.getElementById('mpas-input');
	renderer.draw(camera, stars, mpasToNelm(mpasInput.value));
}

/**
 * Determines if it is possible to submit the sky quality measurement
 */
function preSubmit() {
	clearFeedback();

	/* Select a DOM element to serve as a container for any feedback. */
	var log = document.getElementById('sky-quality-feedback');
	log.style.display = 'block';

	/* Validate sky quality measurement. */
	var mpas = document.getElementById('mpas-input').value;
	if (mpas < 12 || mpas > 21) {
		log.innerHTML = 'Measuement must be in range [12,21]';
		return
	}
	log.innerHTML = 'Submitting measurement...';

	getLatLong(submitLocation, log);
}

/**
 * Submits location of the sky quality measurement
 * @param {Position} position - Position object passed by async request
 */
function submitLocation(position) {
	/* Select a DOM element to serve as a container for any feedback. */
	var log = document.getElementById('sky-quality-feedback');

	/* Gather data. */
	var lat = position.coords.latitude;
	var lon = position.coords.longitude;
	var path = 'v1/Locations';
	var headers = {'Accept': 'application/json'};
	var data = {'lat': lat, 'lon': lon};

	/* Submit request. */
	ajax('POST', url + path, submitMeasurement, log, headers, data);
}

/**
 * Submits the sky quality measurement
 * @param {DOMString} responseText - Server's response
 */
function submitMeasurement(responseText) {
	/* Select a DOM element to serve as a container for any feedback. */
	var log = document.getElementById('sky-quality-feedback');

	/* Determine if the location exists in the database. */
	var response = JSON.parse(responseText);
	if (!('id' in response)
	    || !('lat' in response)
	    || !('lon' in response)
	) {
		log.innerHTML = 'Server failed to create location';
		return;
	}

	/* Gather data. */
	var mpas = document.getElementById('mpas-input').value;
	var id = response['id'];
	var path = 'v1/Locations/' + id + '/SQsamples';
	var headers = {'Accept': 'application/json'};
	var data = {'mpas': mpas};

	/* Submit request. */
	ajax('POST', url + path, postSubmit, log, headers, data);
}

/**
 * Submits the sky quality measurement
 * @param {DOMString} responseText - Server's response
 */
function postSubmit(responseText) {
	/* Select a DOM element to serve as a container for any feedback. */
	var log = document.getElementById('sky-quality-feedback');

	/* Determine if the measurement was submitted successfully. */
	var response = JSON.parse(responseText);
	if (!('id' in response)) {
		log.innerHTML = 'Server failed to create measurement';
	}
	log.innerHTML = 'Measurement submitted';
}

/**
 * Searches for sky quality measurements submitted by the current user
 */
function view() {
	/* Select a DOM element to serve as a container for any feedback. */
	var log = document.getElementById('sky-quality-feedback');
	log.style.display = 'block';

	/* Indicate request-in-progress. */
	log.innerHTML = 'Gathering Submissions...';

	/* Prepare request. */
	var path = 'v1/SQsamples'
	var headers = {'Accept': 'application/json'};

	/* Submit request. */
	ajax('GET', url + path, postView, log, headers);
}

/**
 * Displays results of search samples submitted by the current user
 * @param {DOMString} responseText - Server's response
 */
function postView(responseText) {
	/**
	 * Updates given sky quality measurement to hold the specified value
	 * @para {number} id - Identifier for sky quality measurement
	 * @param {number} mpas - New value for sky quality measurement
	 */
	function updateMeasurement(id, mpas) {
		/* Prepare request. */
		var path = 'v1/SQsamples/' + id;
		var headers = {'Accept': 'application/json'};
		var data = {'mpas': mpas};

		/* Submit request. */
		ajax('PUT', url + path, undefined, undefined, headers, data);
	}

	/**
	 * Deletes given sky quality measurement
	 * @para {number} id - Identifier for sky quality measurement
	 */
	function deleteMeasurement(id) {
		/* Prepare request. */
		var path = 'v1/SQsamples/' + id;
		var headers = {'Accept': 'application/json'};

		/* Submit request. */
		ajax('DELETE', url + path, undefined, undefined, headers);
	}

	/* Select a DOM element to serve as a container for any feedback. */
	var viewResults = document.getElementById('view-results');

	/* Display to the search results page. */
	var viewResultsPage = document.getElementById('view-results-page');
	pages.next(viewResultsPage);

	/* Indicate if no results were found. */
	if (!responseText) {
		viewResults.innerHTML = 'No measurements found';
	}
	else {
		/* Build a table from the search results. */
		var table = document.createElement('table');
		var thead = document.createElement('thead');
		var tbody = document.createElement('tbody');
		var tr = document.createElement('tr');
		var timestamp = document.createElement('th');
		var mpas = document.createElement('th');
		var actions = document.createElement('th');
		table.appendChild(thead);
		table.appendChild(tbody);
		thead.appendChild(tr);
		timestamp.innerHTML = 'timestamp';
		mpas.innerHTML = 'mpas';
		actions.innerHTML = 'actions';
		tr.appendChild(timestamp);
		tr.appendChild(mpas);
		tr.appendChild(actions);

		/* Insert results into table. */
		var response = JSON.parse(responseText);
		for (var i = 0; i < response.length; i++) {
			(function(idx) {
				var result = response[idx];
				var id = result['id'];
				var mpasActual = result['mpas'];

				/* Create DOM elements. */
				var tr = document.createElement('tr');
				var timestamp = document.createElement('td');
				var mpas = document.createElement('td');
				var mpasInput = document.createElement('input');
				var actions = document.createElement('td');
				var resetButton = document.createElement('button');
				var confirmButton = document.createElement('button');
				var deleteButton = document.createElement('button');
				tr.id = id;
				timestamp.innerHTML = result['timestamp'];
				mpasInput.type = 'number';
				mpasInput.step = 0.1;
				mpasInput.value = result['mpas'];
				resetButton.classList.add('reset');
				confirmButton.classList.add('confirm');
				deleteButton.classList.add('delete');

				/* Disable reset & confirm buttons if sample is unmodified. */
				resetButton.disabled = confirmButton.disabled = true;
				mpasInput.addEventListener('input', function(e) {
					var modified = mpasInput.value == mpasActual;
					resetButton.disabled = confirmButton.disabled = modified;
				});

				/* Constrain update range. */
				mpasInput.addEventListener('blur', function(e) {
					mpasInput.value = Math.max(12.0, Math.min(mpasInput.value, 21.0));
				});

				/* Setup update reset handler. */
				mc = new Hammer(resetButton);
				mc.on('tap', function(e) {
					if (!resetButton.disabled) {
						mpasInput.value = mpasActual;
						resetButton.disabled = confirmButton.disabled = true;
					}
				});

				/* Setup update confirmation handler. */
				mc = new Hammer(confirmButton);
				mc.on('tap', function(e) {
					if (!confirmButton.disabled) {
						mpasInput.value = Math.max(12.0, Math.min(mpasInput.value, 21.0));
						updateMeasurement(id, mpasInput.value);
						mpasActual = mpasInput.value;
						resetButton.disabled = confirmButton.disabled = true;
					}
				});

				/* Setup sky quality measurement deletion handler. */
				mc = new Hammer(deleteButton);
				mc.on('tap', function(e) {
					deleteMeasurement(id);
					table.removeChild(tr);
				});

				/* Build DOM subtree. */
				mpas.appendChild(mpasInput);
				actions.appendChild(resetButton);
				actions.appendChild(confirmButton);
				actions.appendChild(deleteButton);
				tr.appendChild(timestamp);
				tr.appendChild(mpas);
				tr.appendChild(actions);
				table.appendChild(tr);
			})(i)
		}

		/* Insert table into results page. */
		while (viewResults.firstChild) {
			viewResults.removeChild(viewResults.firstChild);
		}
		viewResults.appendChild(table);
	}
}

/**
 * Determines if it is possible to submit the sky quality measurement
 */
function preSearch() {
	clearFeedback();

	/* Select a DOM element to serve as a container for any feedback. */
	var log = document.getElementById('search-feedback');
	log.style.display = 'block';

	/* Validate sky quality measurement. */
	var distance = document.getElementById('search-distance-input').value;
	if (distance < 5 || distance > 12500) {
		log.innerHTML = 'Search distance must be in range [5,12500]';
		return;
	}
	log.innerHTML = 'Searching...';

	/* Attempt to retrieve geolocation coordinates. */
	getLatLong(search, log);
}

/**
 * Searches for best stargazing locations with a certain distance
 * @param {Position} position - Position object passed by async request
 */
function search(position) {
	/* Select a DOM element to serve as a container for any feedback. */
	var log = document.getElementById('search-feedback');

	/* Gather data. */
	var dist = document.getElementById('search-distance-input').value;
	var lat = position.coords.latitude;
	var lon = position.coords.longitude;
	var path = 'v1/Locations';
	var headers = {'Accept': 'application/json'};
	var params = {'lat': lat, 'lon': lon, 'dist': dist};

	/* Submit request. */
	ajax('GET', url + path, postSearch, log, headers, undefined, params);
}

/**
 * Displays results of search for stargazing locations
 * @param {DOMString} responseText - Server's response
 */
function postSearch(responseText) {
	/* Select a DOM element to serve as a container for any feedback. */
	var searchResults = document.getElementById('search-results');

	/* Display to the search results page. */
	var resultsPage = document.getElementById('search-results-page');
	pages.next(resultsPage);

	/* Indicate if no results were found. */
	if (!responseText) {
		searchResults.innerHTML = 'No measurements found';
	}
	else {
		/* Build a table from the search results. */
		var table = document.createElement('table');
		var thead = document.createElement('thead');
		var tbody = document.createElement('tbody');
		var tr = document.createElement('tr');
		var mpas = document.createElement('th');
		var lat = document.createElement('th');
		var lon = document.createElement('th');
		var dist = document.createElement('th');
		var subscript = document.createElement('sub');
		table.appendChild(thead);
		table.appendChild(tbody);
		thead.appendChild(tr);
		mpas.innerHTML = 'mpas';
		lat.innerHTML = 'lat °';
		lon.innerHTML = 'lon °';
		dist.innerHTML = 'dist (mi)';
		subscript.innerHTML = 'avg';
		mpas.appendChild(subscript);
		tr.appendChild(mpas);
		tr.appendChild(lat);
		tr.appendChild(lon);
		tr.appendChild(dist);

		/* Insert search results into table. */
		var response = JSON.parse(responseText);
		for (var i = 0; i < response.length; i++) {
			var result = response[i];

			/* Create DOM elements. */
			var tr = document.createElement('tr');
			var mpas = document.createElement('td');
			var lat = document.createElement('td');
			var lon = document.createElement('td');
			var dist = document.createElement('td');
			mpas.innerHTML = result['mpas_avg'];
			lat.innerHTML = result['lat'];
			lon.innerHTML = result['lon'];
			if (parseFloat(result['dist']) < 1.0) {
				dist.innerHTML = '< 1';
			} else {
				dist.innerHTML = parseInt(result['dist'])
			}

			/* Build DOM subtree. */
			tr.appendChild(mpas);
			tr.appendChild(lat);
			tr.appendChild(lon);
			tr.appendChild(dist);
			table.appendChild(tr);
		}

		/* Insert table into results page. */
		var searchResults = document.getElementById('search-results');
		while (searchResults.firstChild) {
			searchResults.removeChild(searchResults.firstChild);
		}
		searchResults.appendChild(table);
	}
}
