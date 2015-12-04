/**
 * @author Brett Fedack
 */

/**
 * Converts given sky brightness value (mpas) to naked eye limiting
 *     magnitude (nelm)
 *     http://www.unihedron.com/projects/darksky/images/MPSASvsNELM.jpg
 *  @param {number} mpas - Magnitudes per arcsecond squared
 *  @return {number} - Naked eye limiting magnitude of given sky quality value
 */
function mpasToNelm(mpas) {
	return 7.93 - 5 * Math.log10(Math.pow(10, (4.316 - mpas / 5)) + 1);
}

/**
 * Converts given Gregorian calendar date & time to sidereal time
 *     https://en.wikipedia.org/wiki/Julian_day
 *     http://aa.usno.navy.mil/faq/docs/GAST.php
 *  @param {Object} dt - Date & time object
 *  @return {number} - Sidereal time representation of given date & time
 */
function gregorianToSidereal(dt) {
	var a, y, m, jd;
	a = Math.floor((14 - dt.month) / 12);
	y = dt.year + 4800 - a;
	m = dt.month + 12 * a - 3;
	jd = (
		dt.day +
		Math.floor((153 * m + 2) / 5) +
		365 * y +
		Math.floor(y / 4) -
		Math.floor(y / 100) +
		Math.floor(y / 400) -
		32045 +
		(dt.hour - 12) / 24 +
		dt.minute / 1440 +
		dt.second / 86400
	);
	return 18.697374558 + 24.06570982441908 * (jd - 2451545);
}

/**
 * Converts given Sidereal time to right ascension
 * @param {number} st - Sidereal time
 * @return {number} - Right ascension in radians
 */
function siderealToRightAscension(st) {
	return st % 24 * 2 * Math.PI / 24;
}
