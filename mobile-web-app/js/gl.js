/**
 * @author Brett Fedack
 */

/**
 * Represents stars as seen from Earth
 * @constructor
 * @param {Array<number>} positions - Star equatorial coordinates
 * @param {Array<number>} magnitudes - Star apparent magnitudes
 */
var StarField = function(positions, magnitudes) {
	this.positions = positions;
	this.magnitudes = magnitudes;
	this.count = magnitudes.length;

	/* Validate arguments. */
	if (positions.length != magnitudes.length * 3) {
		alert(
			'A magnitude value must be provided for each triplet of star' +
			'coordinates'
		);
	}
};

/**
 * Represents a virtual camera in horizon coordinates
 * @constructor
 */
var Camera = function() {
	this.tagModified();

	/* Transforms */
	this.zenith = vec3.fromValues(0, 0, 1);
	this.azimuth = 0;
	this.altitude = 0;        // Degrees

	/* Camera Properties */
	this.aspect = 1.0;
	this.fov = 55.0;          // Degrees
	this.near = 0.01;
	this.far = 1000.0;

	/* Transformation Matrices */
	this.projMatrix = mat4.create();
	this.viewMatrix = mat4.create();
};

/**
 * Creates a camera from given terrestrial coordinates, date, and time
 * @param {number} lat - Latitude in degrees
 * @param {number} lon - Longitude in degrees
 * @param {Object} dt - Date & time (UTC) object
 * @return {Camera} - New camera object
 */
Camera.fromLocation = function(lat, lon, dt) {
	/* Create a new camera. */
	var camera = new Camera();

	/* Convert given date & time to Greenwich sidereal time (GST). */
	var gst = gregorianToSidereal(dt);

	/* Calculate right ascension of zenith along the prime meridian. */
	var raGreenwich = siderealToRightAscension(gst);

	/* Calculate right ascension of zenith at given longitude. */
	var ra = raGreenwich + Math.PI / 180 * lon;
	while (ra < 0) { ra += Math.PI * 2; }

	/* Express declination in radians. */
	var dec = Math.PI / 180 * lat;

	/* Convert right ascension and declination to Cartesian coordinates. */
	var x, y, z, dir;
	x = Math.sin(Math.PI / 2 - dec) * Math.cos(2 * Math.PI - ra);
	y = Math.sin(dec);
	z = Math.sin(Math.PI / 2 - dec) * Math.sin(2 * Math.PI - ra);
	dir = vec3.fromValues(x, y, z);

	/* Orient the camera's zenith to the calculated direction. */
	camera.zenith = dir;

	return camera;
};

Camera.prototype = {
	constructor: Camera,

	/**
	 * Moves this camera to the given geographic location
	 * @param {number} lat - Latitude in degrees
	 * @param {number} lon - Longitude in degrees
	 * @return {Camera} - Reference to this camera
	 */
	relocate: function(lat, lon) {
		this.tagModified();

		/* Determine the current date & time. */
		var date, dt;
		date = new Date();
		dt = {
			'year': date.getUTCFullYear(),
			'month': date.getUTCMonth() + 1,
			'day': date.getUTCDate(),
			'hour': date.getUTCHours(),
			'minute': date.getUTCMinutes(),
			'second': date.getUTCSeconds()
		};

		/* Create a new camera from date, time, and location. */
		camera = Camera.fromLocation(lat, lon, dt);

		/* Copy zenith from new camera to this one. */
		vec3.copy(this.zenith, camera.zenith);

		return this;
	},

	/**
	 * Sets this camera's aspect ratio
	 * @param {number} width - Width of viewport
	 * @param {number} height - Height of viewport
	 * @return {Camera} - Reference to this camera
	 */
	setAspect: function(width, height) {
		/* Calculate aspect ratio from given dimensions. */
		var aspect = width / height;

		/* Only update this camera's aspect if a new value is provided. */
		if (this.aspect !== aspect) {
			this.tagModified();
			this.aspect = aspect;
		}

		return this;
	},

	/**
	 * Adjusts the azimuth angle of this camera
	 * @param {number} delta - Degrees by which to change the azimuth
	 * @return {Camera} - Reference to this camera
	 */
	pivot: function(delta) {
		this.tagModified();

		/* Apply the adjustment. */
		this.azimuth += delta;

		/* Constrain the azimuth to 360 degrees. */
		this.azimuth = this.azimuth % 360;

		/* Express azimuth as a positive value. */
		if (this.azimuth < 0) {
			this.azimuth += 360;
		}

		return this;
	},

	/**
	 * Adjusts the altitude angle of this camera
	 * @param {number} delta - Degrees by which to change the altitude
	 * @return {Camera} - Reference to this camera
	 */
	tilt: function(delta) {
		this.tagModified();

		/* Apply the adjustment. */
		this.altitude += delta;

		/* Constrain the altitude to the range [0, 90). */
		this.altitude = Math.min(Math.max(this.altitude, 0), 89.99);

		return this;
	},

	/**
	 * Indicates that this camera's matrices are not up-to-date
	 * @return {Camera} - Reference to this camera
	 */
	tagModified: function() {
		this.isModified = true;
		return this;
	},

	/**
	 *
	 * Calculates this camera's view transformation matrix
	 * @return {Camera} - Reference to this camera
	 */
	updateViewMatrix: function() {
		/* Initialize this camera's target point to be zenith aligned. */
		var target = vec3.clone(this.zenith);

		/* Create an axis that is perpendicular to this camera's zenith and
		 * the world's north diection. */
		var perp = vec3.create();
		vec3.cross(perp, this.zenith, vec3.fromValues(0, 1, 0));
		if (vec3.len(perp) === 0) { vec3.set(perp, 1, 0, 0); }

		/* Rotate this camera's target point around the perpendicular axis to
		 * match the altitude value. */
		var rotMatrix = mat4.create();
		mat4.rotate(
			rotMatrix,
			mat4.create(),
			(90 - this.altitude) * Math.PI / 180,
			perp
		);
		vec3.transformMat4(target, target, rotMatrix);

		/* Rotate this camera's target point around the zenith to match the
		 * azimuth value. */
		rotMatrix = mat4.create();
		mat4.rotate(
			rotMatrix,
			mat4.create(),
			(360 - this.azimuth) * Math.PI / 180, // Azimuth is clockwise.
			this.zenith
		);
		vec3.transformMat4(target, target, rotMatrix);

		/* Calculate the view transformation matrix. */
		mat4.lookAt(this.viewMatrix, vec3.create(), target, this.zenith);

		return this;
	},

	/**
	 * Calculates this camera's perspective projection matrix
	 * @return {Camera} - Reference to this camera
	 */
	updateProjMatrix: function() {
		mat4.perspective(
			this.projMatrix,
			this.fov * Math.PI / 180,
			this.aspect,
			this.near,
			this.far
		);
		return this;
	},

	/**
	 * Converts this camera's data into text that is suitable as HTML content
	 * @return {string} - HTML formatted string representation of this camera
	 */
	toInnerHTML: function() {
		/* Determine the dominant cardinal direction. */
		var cardinals, dirIdx, dir;
		cardinals = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
		dirIdx = Math.floor((this.azimuth + 45 / 2) % 360 / 45);
		dir = cardinals[dirIdx];

		/* Format the azimuth. */
		var azimuth;
		if (Math.abs(this.zenith[1]) === 1) { // Not defined at poles
			azimuth = 'N/A';
		} else {
			azimuth = this.azimuth.toFixed(1) + '°' + ' (' + dir + ')';
		}

		/* Format the altitude. */
		var altitude = this.altitude.toFixed(1) + '°';

		return 'Azimuth: ' + azimuth + '<br />' + 'Altitude: ' + altitude;
	}
};

Object.defineProperty(Camera.prototype, 'viewProjection', {
	/**
	 * Gets this camera's view projection matrix
	 * @this {Camera} - Reference to this camera
	 * @return {mat4} - View projection matrix
	 */
	get: function() {
		/* Update the view and projection matrices. */
		if (this.isModified) {
			this.updateViewMatrix();
			this.updateProjMatrix();
			this.isModified = false;
		}

		/* Concatenate the view and projection matrices. */
		var out = mat4.create();
		mat4.multiply(out, this.projMatrix, this.viewMatrix);

		return out;
	},
	enumerable: true,
	configurable: true
});

/**
 * WebGL renderer component
 * @constructor
 */
var Renderer = function(){};

Renderer.prototype = {
	constructor: Renderer,

	/**
	 * Initializes this renderer.
	 * @param {Element} canvas - HTML5 canvas element
	 * @param {Element=} opt_log - DOM element to serve as error log (optional)
	 */
	init: function(canvas, opt_log) {
		this.canvas = canvas;
		this.gl = null;
		this.buffer_map = {};
		this.shader_map = {};

		this.createGL(opt_log);
		this.initGL();
		this.initShaders();
	},

	/**
	 * Creates a WebGL rendering context
	 * @param {Element=} opt_log - DOM element to serve as error log (optional)
	 */
	createGL: function(opt_log) {
		var gl;

		/* Attempt to obtain a WebGL context. */
		try {
			gl = this.canvas.getContext('webgl');
		}
		catch (e) {

			/* Indicate that an exception was encountered. */
			if (opt_log) {
				opt_log.style.visibility = 'visible';
				opt_log.innerHTML = e.name + ': ' + e.message;
			}
		}
		if (gl === null) {

			/* Indicate that WebGL does not appear to be supported. */
			if (opt_log) {
				var a;
				opt_log.style.visibility = 'visible';
				opt_log.innerHTML = 'WebGL could not be initialized &nbsp;';
				a = document.createElement('a');
				a.innerHTML = '(help)';
				a.setAttribute('href', 'https://get.webgl.org');
				opt_log.appendChild(a);
			}
		}

		this.gl = gl;
	},

	/**
	 * Initializes the WebGL rendering context
	 */
	initGL: function() {
		var gl = this.gl;
		gl.clearColor(0.0, 0.0, 0.0, 1.0);
		gl.clearDepth(1.0);
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
	},

	/**
	 * Initializes shaders used by this renderer
	 */
	initShaders: function() {
		this.addShader('stars', starsVertShader, starsFragShader);
	},

	/**
	 * Builds a shader program from given source strings and associates it with
	 *	the specified label
	 * @param {string} label - Identifier for shader program
	 * @param {string} vertSrc - Vertex shader source code
	 * @param {string} fragSrc - Fragment shader source code
	 */
	addShader: function(label, vertSrc, fragSrc) {
		var gl = this.gl;
		var vertShader, fragShader, shaderProgram;

		/* Compile the vertex shader binary. */
		vertShader = gl.createShader(gl.VERTEX_SHADER);
		gl.shaderSource(vertShader, vertSrc);
		gl.compileShader(vertShader);
		if (!gl.getShaderParameter(vertShader, gl.COMPILE_STATUS)) {
			alert(
				'An error was encountered when compiling shader: ' +
				gl.getShaderInfoLog(vertShader)
			);
		}

		/* Compile the fragment shader binary. */
		fragShader = gl.createShader(gl.FRAGMENT_SHADER);
		gl.shaderSource(fragShader, fragSrc);
		gl.compileShader(fragShader);
		if (!gl.getShaderParameter(fragShader, gl.COMPILE_STATUS)) {
			alert(
				'An error was encountered when compiling shader: ' +
				gl.getShaderInfoLog(fragShader)
			);
		}

		/* Link the shader binaries. */
		shaderProgram = gl.createProgram();
		gl.attachShader(shaderProgram, vertShader);
		gl.attachShader(shaderProgram, fragShader);
		gl.linkProgram(shaderProgram);
		if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
			alert('An error was encountered when linking shader program.');
		}

		/* Associate shader program with given label. */
		this.shader_map[label] = shaderProgram;
	},

	/**
	 * Renders the scene in its current state
	 * @param {Camera} camera - Camera with which to render the scene
	 * @param {StarField} starField - Star positions and apparent magnitudes
	 * @param {number} nelm - Naked eye limiting magnitude
	 */
	draw: function(camera, starField, nelm) {
		var gl = this.gl;

		/* Update the view projection. */
		this.canvas.width = this.canvas.clientWidth;
		this.canvas.height = this.canvas.clientHeight;
		gl.viewport(0, 0, this.canvas.clientWidth, this.canvas.clientHeight);
		camera.setAspect(this.canvas.clientWidth, this.canvas.clientHeight);

		/* Clear any existing information in the draw buffer. */
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

		/* Draw the star field. */
		this.drawStars(camera, starField, nelm);
	},

	/**
	 * Renders the star field, providing a visualzation of sky quality
	 * @param {Camera} camera - Camera with which to render the scene
	 * @param {StarField} starField - Star positions and apparent magnitudes
	 * @param {number} nelm - Naked eye limiting magnitude
	 */
	drawStars: function(camera, starField, nelm) {
		var gl = this.gl;

		/* Select the shader to use. */
		gl.useProgram(this.shader_map['stars']);

		/* Store star position information in a GPU buffer. */
		if (!('starPositions' in this.buffer_map)) {
			var starPositionBuffer;
			starPositionBuffer = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, starPositionBuffer);
			gl.bufferData(
				gl.ARRAY_BUFFER,
				new Float32Array(starField.positions),
				gl.STATIC_DRAW
			);
			this.buffer_map['starPositions'] = starPositionBuffer;
		}

		/* Store star magnitude information in a GPU buffer. */
		if (!('starMagnitudes' in this.buffer_map)) {
			var starMagnitudeBuffer;
			starMagnitudeBuffer = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, starMagnitudeBuffer);
			gl.bufferData(
				gl.ARRAY_BUFFER,
				new Float32Array(starField.magnitudes),
				gl.STATIC_DRAW
			);
			this.buffer_map['starMagnitudes'] = starMagnitudeBuffer;
		}

		/* Associate star position buffer items with the vertex shader. */
		var positionAttr;
		gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer_map['starPositions']);
		positionAttr = gl.getAttribLocation(
			this.shader_map['stars'],
			'position'
		);
		gl.enableVertexAttribArray(positionAttr);
		gl.vertexAttribPointer(positionAttr, 3, gl.FLOAT, gl.FALSE, 0, 0);

		/* Associate star magnitude buffer items with the vertex shader. */
		var magnitudeAttr;
		gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer_map['starMagnitudes']);
		magnitudeAttr = gl.getAttribLocation(
			this.shader_map['stars'],
			'magnitude'
		);
		gl.enableVertexAttribArray(magnitudeAttr);
		gl.vertexAttribPointer(magnitudeAttr, 1, gl.FLOAT, gl.FALSE, 0, 0);

		/* Specify the view projection. */
		var viewProjection = camera.viewProjection;
		var viewProjectionUniform = gl.getUniformLocation(
			this.shader_map['stars'],
			'viewProjection'
		);
		gl.uniformMatrix4fv(viewProjectionUniform, false, viewProjection);

		/* Specify the naked eye limiting magnitude. */
		var nelmUniform = gl.getUniformLocation(
			this.shader_map['stars'],
			'nelm'
		);
		gl.uniform1f(nelmUniform, nelm);

		/* Draw the star field. */
		gl.drawArrays(gl.POINTS, 0, starField.count);

		/* Cleanup */
		gl.disableVertexAttribArray(positionAttr);
		gl.disableVertexAttribArray(magnitudeAttr);
	}
};

var starsVertShader = [
	'precision mediump float;',

	'attribute float magnitude;',
	'attribute vec3 position;',

	'uniform float nelm;',
	'uniform mat4 viewProjection;',

	'varying float alpha;',

	'void main(void) {',
	'	gl_Position = viewProjection * vec4(position, 1.0);',
	'   gl_PointSize = 2.0;',
	'	alpha = (nelm - magnitude + 0.2) / 3.0;', // Fudge-factor, not accurate
	'}'
].join('\n');

var starsFragShader = [
	'precision mediump float;',

	'varying float alpha;',

	'void main(void) {',
	'	gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);',
	'}'
].join('\n');
