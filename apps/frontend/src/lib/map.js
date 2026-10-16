export function hasPickupCoordinates(post) {
  const lat = post?.pickup_lat, lng = post?.pickup_lng;
  return typeof lat === 'number' && Number.isFinite(lat) && lat >= -90 && lat <= 90
    && typeof lng === 'number' && Number.isFinite(lng) && lng >= -180 && lng <= 180;
}
export function availableMapPosts(posts, now = Date.now()) {
  return posts.filter(post => post.status === 'active' && post.quantity_remaining > 0 && Date.parse(post.expires_at) > now);
}
