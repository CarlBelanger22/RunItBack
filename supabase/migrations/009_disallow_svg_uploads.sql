-- 009: Disallow SVG uploads on team-assets (XSS surface).
-- Client already rejects SVG; this enforces at the Storage bucket.

update storage.buckets
set allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
where id = 'team-assets';
