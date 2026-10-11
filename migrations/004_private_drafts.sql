-- A draft hunt was stored visible to everyone and only hidden by the page, so
-- its list could be read before the start. New drafts are written 'private'
-- (the organizer alone, and the tasks inherit it) and opened to everyone when
-- the hunt starts; this does the same for the drafts already stored. Both
-- columns are plaintext, so the comparison and the new value are literal.
UPDATE app_scavenger_hunt__hunts SET visibility = 'private' WHERE status = 'draft';
