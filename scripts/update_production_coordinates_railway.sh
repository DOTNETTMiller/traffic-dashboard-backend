#!/bin/bash

# Update production parking_facilities coordinates via Railway CLI

echo "📍 Updating Production Parking Facility Coordinates via Railway"
echo ""

# Array of coordinate updates (facility_id|latitude|longitude)
coordinates=(
  "tpims-historical-ky00065is000020nsmarathon|37.3506|-85.9003"
  "tpims-historical-ia00080is001510oejaspscal|41.682497|-93.334167"
  "tpims-historical-ky00075is0007500swaltonws|37.6667|-84.2833"
  "tpims-historical-ia00080is0030000wra300w00|41.597293|-90.479436"
  "tpims-historical-ia00080is0018000wra180w00|41.695938|-92.772399"
  "tpims-historical-ky00065is0000020n65welcom|37.3506|-85.9003"
  "tpims-historical-ky00065is0005900n65nra059|37.3506|-85.9003"
  "tpims-historical-ky00065is0000340nweighs34|37.3506|-85.9003"
  "tpims-historical-ia00080is0022000wmcdonald|41.689367|-92.006667"
  "tpims-historical-ky00065is0005900s65sra059|37.3506|-85.9003"
  "tpims-historical-ky00065is0011400s65sra114|37.3506|-85.9003"
  "tpims-historical-ia00080is0027700wra277w00|41.660607|-91.124893"
  "tpims-historical-ky00075is0000100n75welcom|37.6667|-84.2833"
  "tpims-historical-ia00080is0027200wra272w00|41.647669|-91.251709"
  "tpims-historical-mn00094is0021500eelmcreek|46.0|-95.3333"
  "tpims-historical-mn00094is0025580w0stcroix|46.0|-95.3333"
  "tpims-historical-ia00080is0027200era272e00|41.647669|-91.251709"
  "tpims-historical-ia00080is0024300wra243w00|41.722912|-91.590443"
  "tpims-historical-ia00080is0021100wra211w00|41.720787|-91.928921"
  "tpims-historical-ia00080is0027700era277e00|41.660607|-91.124893"
  "tpims-historical-ia00080is0024300era243e00|41.722912|-91.590443"
  "tpims-historical-ia00080is0021100era211e00|41.720787|-91.928921"
  "tpims-historical-ky00075is0017700n75nra177|37.6667|-84.2833"
  "tpims-historical-ky00075is0003300nweighs33|37.6667|-84.2833"
  "tpims-historical-ia00080is0019800wra198w00|41.675591|-92.197685"
  "tpims-historical-ky00075is0017700s75sra177|37.6667|-84.2833"
  "tpims-historical-ky00075is0003400sweighs34|37.6667|-84.2833"
  "tpims-historical-ky00075is0016800scritenws|37.6667|-84.2833"
  "tpims-historical-ia00080is0019800era198e00|41.675591|-92.197685"
  "tpims-historical-in00080is00012600wra0126w00|41.6784|-86.1236"
  "tpims-historical-in00080is00012600era0126e00|41.6784|-86.1236"
  "tpims-historical-in00080is0005600wra0108w00|41.6784|-86.1236"
  "tpims-historical-in00080is0005600wra090w00|41.6784|-86.1236"
  "tpims-historical-in00080is0005600era108e00|41.6784|-86.1236"
  "tpims-historical-in00080is0005600era090e00|41.6784|-86.1236"
  "tpims-historical-in00080is0003700wra037w00|41.6784|-86.1236"
  "tpims-historical-in00080is0002200wra022w00|41.6784|-86.1236"
  "tpims-historical-ia00080is0016400wra164w00|41.655197|-92.450958"
  "tpims-historical-in00080is0003700era037e00|41.6784|-86.1236"
  "tpims-historical-in00080is0002200era022e00|41.6784|-86.1236"
  "tpims-historical-mn00094is0009960elklatoka|46.0|-95.3333"
  "tpims-historical-ia00080is0016400era164e00|41.655197|-92.450958"
  "tpims-historical-ia00080is0014200wroyaloak|41.729355|-92.719238"
  "tpims-historical-ia00080is0014200eroyaloak|41.729355|-92.719238"
  "tpims-historical-ia00080is0012200wra122w00|41.672886|-92.997063"
  "tpims-historical-co00070is004050oesieberpr|39.75|-104.95"
  "tpims-historical-ia00080is0012200era122e00|41.672886|-92.997063"
  "tpims-historical-ia00080is0010600wra106w00|41.697258|-93.181671"
  "tpims-historical-ia00080is0010600era106e00|41.697258|-93.181671"
  "tpims-historical-ia00080is0009500wmitchel|41.721504|-93.334808"
  "tpims-historical-ia00080is0009500emitchel|41.721504|-93.334808"
  "tpims-historical-ia00080is0008000wra080w00|41.615967|-93.557266"
  "tpims-historical-ia00080is0008000era080e00|41.615967|-93.557266"
  "tpims-historical-ia00380is0001140wra11w000|41.867239|-91.670361"
  "tpims-historical-mn00094is0018700e0enfield|46.0|-95.3333"
  "tpims-historical-ia00080is0006000wra060w00|41.586311|-93.790161"
  "tpims-historical-mn00035is0013200sforestlk|45.2833|-92.9833"
  "tpims-historical-ia00080is0006000era060e00|41.586311|-93.790161"
  "tpims-historical-ia00080is0004300wra043w00|41.521751|-94.004311"
  "tpims-historical-mn00094is0015170ebigspunk|46.0|-95.3333"
  "tpims-historical-ia00080is0004300era043e00|41.521751|-94.004311"
  "tpims-historical-ia00080is0003600wdexfield|41.496399|-94.122055"
  "tpims-historical-ia00080is0003600edexfield|41.496399|-94.122055"
  "tpims-historical-ia00080is0003000era300e00|41.597293|-90.479436"
  "tpims-historical-ia00080is0001800era180e00|41.695938|-92.772399"
  "tpims-historical-ia00380is0001140sra11s000|41.867239|-91.670361"
  "tpims-historical-ia00080is0001800era180e00|41.694393|-92.772218"
)

echo "Total facilities to update: ${#coordinates[@]}"
echo ""

# Build a single SQL script with all updates
sql_script="BEGIN;"

for coord in "${coordinates[@]}"; do
  IFS='|' read -r facility_id latitude longitude <<< "$coord"
  sql_script="$sql_script
  UPDATE parking_facilities SET latitude = $latitude, longitude = $longitude WHERE facility_id = '$facility_id';"
done

sql_script="$sql_script
COMMIT;"

echo "Executing batch update on production database..."

# Execute via railway CLI
railway run bash -c "psql \$DATABASE_URL -c \"$sql_script\""

echo ""
echo "✅ Coordinate update completed!"
echo ""
echo "Verifying results..."
railway run bash -c "psql \$DATABASE_URL -c \"SELECT COUNT(*) as total, SUM(CASE WHEN latitude IS NOT NULL AND latitude != 0 THEN 1 ELSE 0 END) as with_coords FROM parking_facilities;\""
