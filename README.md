# Tala Mboka Crisis Backend

Node.js + Express API for Tala Mboka Crisis.

## Core capabilities

- JWT admin/moderator authentication with bcrypt password hashing.
- Public guest report intake with image upload, validation, rate limiting, and offline-sync metadata.
- MongoDB report model with geolocation, damage classification, reporter metadata, building footprint reference, duplicate tracking, and versioning.
- Multi-crisis workspaces through `crisisId`, with crisis-scoped feeds, exports, and duplicate detection.
- Admin-only report validation, editing, deletion, user management, and audit trail.
- CSV and GeoJSON exports for UNDP/GIS workflows.

## Scale notes

Reports are indexed by `crisisId`, `createdAt`, `collectionTime`, `crisisType`, `damageLevel`, `assetId`, `buildingFootprint.id`, `duplicateOf`, and `location` as a 2dsphere field. This supports crisis-scoped feeds, geospatial queries, duplicate/version review, and export jobs for hundreds of thousands of records per crisis.

For production scale, run MongoDB Atlas with backups and autoscaling, store images in Cloudinary or S3-compatible object storage, and add a background worker queue for AI classification, translation, and export generation.

## Main endpoints

- `POST /api/admin/login`
- `GET /api/admin/reports`
- `PATCH /api/admin/reports/:id`
- `PATCH /api/admin/reports/:id/status`
- `DELETE /api/admin/reports/:id`
- `GET /api/admin/users`
- `POST /api/admin/users`
- `GET /api/admin/audit`
- `GET /api/crises`
- `GET /api/crises/admin`
- `POST /api/crises`
- `PATCH /api/crises/:id`
- `POST /api/reports/guest`
- `GET /api/reports`
- `GET /api/reports/export/csv`
- `GET /api/reports/export/geojson`
