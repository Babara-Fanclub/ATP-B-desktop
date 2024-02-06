/** Functions to interpolate points between two locations. */
/** Interates through elements pairwise.
 *
 * @see{https://stackoverflow.com/questions/31973278/iterate-an-array-as-a-pair-current-next-in-javascript}
 * */
function* pairwise(iterable) {
  const iterator = iterable[Symbol.iterator]();
  let a = iterator.next();
  if (a.done) return;
  let b = iterator.next();
  while (!b.done) {
    yield [a.value, b.value];
    a = b;
    b = iterator.next();
  }
}

/** Fill in the points with fixed distance between them.
 *
 * @param {Array<[number, number]>} points The points to interpolate.
 * @param {number} distance The distance between the points.
 * @returns {Array<[number, number]>} An array with interpolated points.
 * */
function interpolate(distance, points) {
  // TODO: Add interpolation implementation
  return [points[1]];
}

/** Fill in the points with fixed distance between them.
 *
 * @param {Array<[number, number]>} points The points to interpolate.
 * @param {number} distance The distance between the points.
 * @returns {Array<[number, number]>} An array with interpolated points.
 * */
export function interpolate_points(points, distance) {
  const array = Array.from(pairwise(points)).flatMap(interpolate.bind(null, distance));
  array.unshift(points[0]);
  return array;
}

export default interpolate_points;
