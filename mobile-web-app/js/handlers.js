/*
 * @author Brett Fedack
 */

/*
 * Registers event handlers with relevant DOM elements.
 */
function setupHandlers() {
	/* Retrieve DOM elements. */
	var cameraLabel = document.getElementById('camera-label');
	var canvas = document.getElementById('webgl');
	var errorLog = document.getElementById('sky-quality-feedback');
	var mpasInput = document.getElementById('mpas-input');
	var mpasInputLabel = document.getElementById('mpas-input-label');
	var mpasControl = document.getElementById('mpas-control');
	var mpasControlLabel = document.getElementById('mpas-control-label');
	var measureButton = document.getElementById('measure');
	var submitButton = document.getElementById('submit');
	var viewButton = document.getElementById('view');
	var searchDistanceInput = document.getElementById('search-distance-input');
	var searchButton = document.getElementById('search');
	var backButtons = document.getElementsByClassName('back');

	/* Build event handlers. */
	var navHandler = buildNavHandler(
		camera, cameraLabel, renderer, stars, mpasInput
	);
	var mpasControlHandler = buildControlHandler(
		camera, renderer, stars, mpasInput, mpasControlLabel
	);

	/* Register event handlers. */
	var mc = new Hammer.Manager(canvas);;
	mc.add(new Hammer.Pan({direction: Hammer.DIRECTION_ALL, threshold: 0}));
	mc.on('panstart panend panmove', navHandler);
	mc = new Hammer(measureButton);
	mc.on('tap', function(e) {preMeasure();});
	mc = new Hammer(submitButton);
	mc.on('tap', function(e) {preSubmit();});
	mc = new Hammer(viewButton);
	mc.on('tap', function(e) {view();});
	mc = new Hammer(searchButton);
	mc.on('tap', function(e) {preSearch();});
	mpasControl.addEventListener('touchstart', mpasControlHandler);
	mpasControl.addEventListener('touchend', mpasControlHandler);
	mpasControl.addEventListener('input', mpasControlHandler);
	window.addEventListener('resize', function(e) {
		/* Redraw the scene. */
		renderer.draw(camera, stars, mpasToNelm(mpasInput.value));
	});
	for (var i = 0; i < backButtons.length; i++) {
		(function(idx) {
			/* Backtrace the page stack. */
			var back = function(e) {
				clearFeedback();
				pages.back();
			};
			var buttonListener = new Hammer(backButtons[idx]);
			buttonListener.on('tap', back);
		})(i);
	}

	/**
	 * Builds a closure for handling viewport navigation
	 * @return {function} - Closure for navigating the viewport
	 */
	function buildNavHandler() {
		/* Store persistent, internal state. */
		var sensitivity = 0.125;
		var navInProgress = false;
		var prevDeltaX, prevDeltaY;

		/**
		 * Navigates the viewport with mouse/touch-based controls
		 * @param {Event} e - DOM event object for mouse/touch input
		 */
		return function(e) {
			e.preventDefault();

			/* Handle each type of relevant mouse/touch event. */
			if (e.type === 'mousedown' || e.type === 'panstart') {
				navInProgress = true;

				/* Reveal the camera info. */
				cameraLabel.style.visibility = 'visible';

				/* Reset pan deltas values. */
				if (e.type === 'panstart') {
					prevDeltaX = prevDeltaY = 0;
				}
			}
			else if (e.type === 'mouseup' || e.type === 'panend') {
				navInProgress = false;

				/* Hide the camera info, unless actively navigating. */
				cameraLabel.style.visibility = 'hidden';
			}
			else if (e.type === 'mousemove' || e.type === 'panmove') {
				if (navInProgress) {
					/* Calculate movement. */
					var movementX, movementY;
					if (e.type === 'panmove') {
						movementX = e.deltaX - prevDeltaX;
						movementY = e.deltaY - prevDeltaY;

						/* Update pan delta values. */
						prevDeltaX = e.deltaX;
						prevDeltaY = e.deltaY;
					} else {
						movementX = e.movementX;
						movementY = e.movementY;
					}

					/* Update camera state. */
					cameraLabel.innerHTML = camera.toInnerHTML();
					camera.pivot(-1 * sensitivity * movementX);
					camera.tilt(sensitivity * movementY);

					/* Redraw the scene. */
					renderer.draw(camera, stars, mpasToNelm(mpasInput.value));
				}
			}
		}
	}

	/**
	 * Builds a closure for estimating a sky quality value
	 * @return {function} - Closure for estimating a sky quality value
	 */
	function buildControlHandler() {
		/* Store persistent, internal state. */
		var updateInProgress = false;

		/**
		 * Estimates a sky quality value
		 * @param {Event} e - DOM event object for mouse/touch input
		 */
		return function(e) {
			/* Handle each type of relevant mouse/touch/update event. */
			if (e.type === 'mousedown' || e.type === 'touchstart') {
					updateInProgress = true;

				/* Reveal controller feedback, if available. */
				if (mpasControlLabel.innerHTML) {
					mpasControlLabel.style.visibility = 'visible';
				}
			}
			else if (e.type === 'mouseup' || e.type === 'touchend') {
				updateInProgress = false;

				/* Hide controller feedback. */
				mpasControlLabel.style.visibility = 'hidden';
			}
			else if (e.type === 'input') {
				/* Update controller feedback. */
				mpasControlLabel.innerHTML = (
					'Sky Quality: ' +
					parseFloat(e.target.value).toFixed(2) +
					' (mpas)'
				);

				/* Update sky quality value. */
				mpasInput.value = e.target.value;

				/* Redraw the scene. */
				renderer.draw(camera, stars, mpasToNelm(mpasInput.value));
			}
		}
	}
}
