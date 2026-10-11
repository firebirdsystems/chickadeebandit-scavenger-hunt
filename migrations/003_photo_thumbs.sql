-- A small copy of the same photo for grids and lists, made in the browser at
-- upload and stored by the hub with the photo. NULL when none was kept (a
-- photo that is already small, a format the browser could not draw, a find
-- with a caption only) and for every photo added before this column: the
-- photo itself is drawn instead.
ALTER TABLE app_scavenger_hunt__submissions ADD COLUMN thumb_file_id TEXT;
