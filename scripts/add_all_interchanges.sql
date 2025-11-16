-- Illinois
INSERT INTO interchanges (name, state_key, corridor, latitude, longitude, watch_radius_km, notify_states, detour_message, active) VALUES
('I-90 & I-94 (Chicago, IL)', 'illinois', 'I-90', 41.8781, -87.6298, 15, 'illinois,indiana,wisconsin', 'Major junction in Chicago. Impacts traffic to/from Milwaukee and Northwest Indiana.', 1),
('I-55 & I-80 (Joliet, IL)', 'illinois', 'I-55', 41.5253, -88.0817, 15, 'illinois,indiana', 'Key southern Chicago bypass junction.', 1),
('I-57 & I-24 (Marion, IL)', 'illinois', 'I-57', 37.7306, -88.9331, 15, 'illinois,kentucky,missouri', 'Southern Illinois gateway to Kentucky and Missouri.', 1),
('I-70 & I-55 (Troy, IL)', 'illinois', 'I-70', 38.7289, -89.8831, 15, 'illinois,missouri', 'East St. Louis area - major Missouri crossing.', 1);

-- Wisconsin
INSERT INTO interchanges (name, state_key, corridor, latitude, longitude, watch_radius_km, notify_states, detour_message, active) VALUES
('I-90 & I-94 (Madison, WI)', 'wisconsin', 'I-90', 43.0731, -89.4012, 15, 'wisconsin,minnesota,illinois', 'Madison area - connects Twin Cities to Chicago.', 1),
('I-43 & I-94 (Milwaukee, WI)', 'wisconsin', 'I-43', 43.0389, -87.9065, 15, 'wisconsin,illinois', 'Milwaukee downtown interchange.', 1),
('I-39 & I-90/94 (Portage, WI)', 'wisconsin', 'I-90', 43.5391, -89.4626, 15, 'wisconsin,minnesota', 'Central Wisconsin junction.', 1);

-- Michigan
INSERT INTO interchanges (name, state_key, corridor, latitude, longitude, watch_radius_km, notify_states, detour_message, active) VALUES
('I-75 & I-96 (Detroit, MI)', 'michigan', 'I-75', 42.3314, -83.0458, 15, 'michigan,ohio', 'Detroit downtown - major Canada crossing nearby.', 1),
('I-94 & I-69 (Marshall, MI)', 'michigan', 'I-94', 42.2723, -84.9633, 15, 'michigan,indiana', 'South-central Michigan junction.', 1),
('I-75 & I-69 (Flint, MI)', 'michigan', 'I-75', 43.0125, -83.6875, 15, 'michigan', 'Flint area junction.', 1);

-- Missouri
INSERT INTO interchanges (name, state_key, corridor, latitude, longitude, watch_radius_km, notify_states, detour_message, active) VALUES
('I-70 & I-435 (Kansas City, MO)', 'missouri', 'I-70', 39.0997, -94.5786, 15, 'missouri,kansas', 'Kansas City beltway - major junction.', 1),
('I-44 & I-270 (St. Louis, MO)', 'missouri', 'I-44', 38.5525, -90.4125, 15, 'missouri,illinois', 'St. Louis southwest junction.', 1),
('I-70 & I-44 (St. Louis, MO)', 'missouri', 'I-70', 38.6270, -90.1994, 15, 'missouri,illinois', 'Downtown St. Louis interchange.', 1);

-- Kentucky
INSERT INTO interchanges (name, state_key, corridor, latitude, longitude, watch_radius_km, notify_states, detour_message, active) VALUES
('I-65 & I-64 (Louisville, KY)', 'kentucky', 'I-65', 38.2527, -85.7585, 15, 'kentucky,indiana', 'Louisville downtown - Indiana border crossing.', 1),
('I-75 & I-64 (Lexington, KY)', 'kentucky', 'I-75', 38.0406, -84.5037, 15, 'kentucky,ohio,tennessee', 'Lexington area - central Kentucky hub.', 1),
('I-24 & I-69 (Paducah, KY)', 'kentucky', 'I-24', 37.0842, -88.6000, 15, 'kentucky,illinois,tennessee', 'Western Kentucky junction.', 1);

-- Tennessee
INSERT INTO interchanges (name, state_key, corridor, latitude, longitude, watch_radius_km, notify_states, detour_message, active) VALUES
('I-40 & I-24 (Nashville, TN)', 'tennessee', 'I-40', 36.1627, -86.7816, 15, 'tennessee,kentucky,arkansas', 'Nashville downtown interchange.', 1),
('I-75 & I-40 (Knoxville, TN)', 'tennessee', 'I-75', 35.9606, -83.9207, 15, 'tennessee,kentucky,northcarolina', 'East Tennessee junction.', 1),
('I-40 & I-240 (Memphis, TN)', 'tennessee', 'I-40', 35.1495, -90.0490, 15, 'tennessee,arkansas,mississippi', 'Memphis area - Mississippi River crossing.', 1);

-- Arkansas
INSERT INTO interchanges (name, state_key, corridor, latitude, longitude, watch_radius_km, notify_states, detour_message, active) VALUES
('I-40 & I-30 (Little Rock, AR)', 'arkansas', 'I-40', 34.7465, -92.2896, 15, 'arkansas,tennessee,texas', 'Little Rock junction.', 1),
('I-55 & I-40 (West Memphis, AR)', 'arkansas', 'I-55', 35.1495, -90.1848, 15, 'arkansas,tennessee,missouri', 'Memphis area crossing.', 1);

-- Louisiana
INSERT INTO interchanges (name, state_key, corridor, latitude, longitude, watch_radius_km, notify_states, detour_message, active) VALUES
('I-10 & I-12 (Baton Rouge, LA)', 'louisiana', 'I-10', 30.4515, -91.1871, 15, 'louisiana,mississippi', 'Baton Rouge junction.', 1),
('I-10 & I-610 (New Orleans, LA)', 'louisiana', 'I-10', 29.9511, -90.0715, 15, 'louisiana,mississippi', 'New Orleans area.', 1),
('I-20 & I-49 (Shreveport, LA)', 'louisiana', 'I-20', 32.5252, -93.7502, 15, 'louisiana,texas,arkansas', 'Northwest Louisiana junction.', 1);

-- Mississippi
INSERT INTO interchanges (name, state_key, corridor, latitude, longitude, watch_radius_km, notify_states, detour_message, active) VALUES
('I-55 & I-20 (Jackson, MS)', 'mississippi', 'I-55', 32.2988, -90.1848, 15, 'mississippi,louisiana,alabama', 'Jackson downtown interchange.', 1),
('I-59 & I-10 (Gulfport, MS)', 'mississippi', 'I-10', 30.3674, -89.0928, 15, 'mississippi,louisiana,alabama', 'Gulf Coast junction.', 1);

-- Alabama
INSERT INTO interchanges (name, state_key, corridor, latitude, longitude, watch_radius_km, notify_states, detour_message, active) VALUES
('I-65 & I-20/59 (Birmingham, AL)', 'alabama', 'I-65', 33.5207, -86.8025, 15, 'alabama,tennessee,mississippi', 'Birmingham downtown - major junction.', 1),
('I-85 & I-65 (Montgomery, AL)', 'alabama', 'I-85', 32.3792, -86.3077, 15, 'alabama,georgia', 'Montgomery area.', 1);

-- Georgia
INSERT INTO interchanges (name, state_key, corridor, latitude, longitude, watch_radius_km, notify_states, detour_message, active) VALUES
('I-85 & I-75 (Atlanta, GA)', 'georgia', 'I-85', 33.7490, -84.3880, 15, 'georgia,alabama,southcarolina,tennessee', 'Downtown Atlanta - major junction.', 1),
('I-16 & I-95 (Savannah, GA)', 'georgia', 'I-16', 32.0809, -81.0912, 15, 'georgia,southcarolina', 'Savannah area.', 1),
('I-75 & I-575 (Marietta, GA)', 'georgia', 'I-75', 34.0522, -84.5499, 15, 'georgia,tennessee', 'North Atlanta area.', 1);

-- Florida
INSERT INTO interchanges (name, state_key, corridor, latitude, longitude, watch_radius_km, notify_states, detour_message, active) VALUES
('I-95 & I-4 (Daytona Beach, FL)', 'florida', 'I-95', 29.1816, -81.0228, 15, 'florida,georgia', 'Central Florida junction.', 1),
('I-75 & I-4 (Tampa, FL)', 'florida', 'I-75', 28.0606, -82.4572, 15, 'florida', 'Tampa area junction.', 1),
('I-95 & I-595 (Fort Lauderdale, FL)', 'florida', 'I-95', 26.1224, -80.1373, 15, 'florida', 'South Florida junction.', 1);

-- South Carolina
INSERT INTO interchanges (name, state_key, corridor, latitude, longitude, watch_radius_km, notify_states, detour_message, active) VALUES
('I-26 & I-95 (Orangeburg, SC)', 'southcarolina', 'I-26', 33.4918, -80.8557, 15, 'southcarolina,northcarolina,georgia', 'Central SC junction.', 1),
('I-85 & I-26 (Spartanburg, SC)', 'southcarolina', 'I-85', 34.9496, -81.9320, 15, 'southcarolina,northcarolina', 'Upstate SC junction.', 1);

-- North Carolina
INSERT INTO interchanges (name, state_key, corridor, latitude, longitude, watch_radius_km, notify_states, detour_message, active) VALUES
('I-85 & I-40 (Greensboro, NC)', 'northcarolina', 'I-85', 35.9132, -79.7920, 15, 'northcarolina,virginia,tennessee', 'Central NC junction.', 1),
('I-95 & I-40 (Benson, NC)', 'northcarolina', 'I-95', 35.3779, -78.5528, 15, 'northcarolina,virginia,southcarolina', 'Eastern NC junction.', 1);

-- Virginia
INSERT INTO interchanges (name, state_key, corridor, latitude, longitude, watch_radius_km, notify_states, detour_message, active) VALUES
('I-95 & I-64 (Richmond, VA)', 'virginia', 'I-95', 37.5407, -77.4360, 15, 'virginia,northcarolina,maryland', 'Richmond downtown.', 1),
('I-81 & I-64 (Lexington, VA)', 'virginia', 'I-81', 37.7843, -79.4428, 15, 'virginia,westvirginia,tennessee', 'Shenandoah Valley junction.', 1);

-- West Virginia
INSERT INTO interchanges (name, state_key, corridor, latitude, longitude, watch_radius_km, notify_states, detour_message, active) VALUES
('I-77 & I-64 (Charleston, WV)', 'westvirginia', 'I-77', 38.3498, -81.6326, 15, 'westvirginia,virginia,kentucky,ohio', 'Charleston area.', 1),
('I-79 & I-68 (Morgantown, WV)', 'westvirginia', 'I-79', 39.6295, -79.9559, 15, 'westvirginia,pennsylvania,maryland', 'North WV junction.', 1);

-- Maryland
INSERT INTO interchanges (name, state_key, corridor, latitude, longitude, watch_radius_km, notify_states, detour_message, active) VALUES
('I-95 & I-695 (Baltimore, MD)', 'maryland', 'I-95', 39.2904, -76.6122, 15, 'maryland,delaware,pennsylvania', 'Baltimore beltway junction.', 1),
('I-70 & I-270 (Frederick, MD)', 'maryland', 'I-70', 39.4143, -77.4105, 15, 'maryland,pennsylvania,virginia', 'Western Maryland junction.', 1);

-- Delaware
INSERT INTO interchanges (name, state_key, corridor, latitude, longitude, watch_radius_km, notify_states, detour_message, active) VALUES
('I-95 & I-295 (Wilmington, DE)', 'delaware', 'I-95', 39.7447, -75.5484, 15, 'delaware,pennsylvania,newjersey,maryland', 'Northern Delaware junction.', 1);

-- New York
INSERT INTO interchanges (name, state_key, corridor, latitude, longitude, watch_radius_km, notify_states, detour_message, active) VALUES
('I-87 & I-90 (Albany, NY)', 'newyork', 'I-87', 42.6526, -73.7562, 15, 'newyork,massachusetts,vermont', 'Capital region junction.', 1),
('I-90 & I-290 (Buffalo, NY)', 'newyork', 'I-90', 42.8864, -78.8784, 15, 'newyork,pennsylvania', 'Western NY junction.', 1),
('I-81 & I-690 (Syracuse, NY)', 'newyork', 'I-81', 43.0481, -76.1474, 15, 'newyork,pennsylvania', 'Central NY junction.', 1);

-- Connecticut
INSERT INTO interchanges (name, state_key, corridor, latitude, longitude, watch_radius_km, notify_states, detour_message, active) VALUES
('I-95 & I-91 (New Haven, CT)', 'connecticut', 'I-95', 41.3083, -72.9279, 15, 'connecticut,newyork,massachusetts,rhodeisland', 'Southern CT junction.', 1),
('I-84 & I-91 (Hartford, CT)', 'connecticut', 'I-84', 41.7658, -72.6734, 15, 'connecticut,massachusetts', 'Hartford area.', 1);

-- Rhode Island
INSERT INTO interchanges (name, state_key, corridor, latitude, longitude, watch_radius_km, notify_states, detour_message, active) VALUES
('I-95 & I-195 (Providence, RI)', 'rhodeisland', 'I-95', 41.8240, -71.4128, 15, 'rhodeisland,massachusetts,connecticut', 'Providence junction.', 1);

-- Massachusetts
INSERT INTO interchanges (name, state_key, corridor, latitude, longitude, watch_radius_km, notify_states, detour_message, active) VALUES
('I-90 & I-495 (Westborough, MA)', 'massachusetts', 'I-90', 42.3001, -71.6162, 15, 'massachusetts,newyork,rhodeisland', 'Boston outer loop.', 1),
('I-93 & I-95 (Woburn, MA)', 'massachusetts', 'I-93', 42.4792, -71.1523, 15, 'massachusetts,newhampshire', 'North Boston area.', 1);

-- New Hampshire
INSERT INTO interchanges (name, state_key, corridor, latitude, longitude, watch_radius_km, notify_states, detour_message, active) VALUES
('I-93 & I-89 (Concord, NH)', 'newhampshire', 'I-93', 43.2081, -71.5376, 15, 'newhampshire,vermont,massachusetts', 'Central NH junction.', 1);

-- Vermont
INSERT INTO interchanges (name, state_key, corridor, latitude, longitude, watch_radius_km, notify_states, detour_message, active) VALUES
('I-89 & I-91 (White River Junction, VT)', 'vermont', 'I-89', 43.6489, -72.3190, 15, 'vermont,newhampshire,newyork', 'Eastern Vermont junction.', 1);

-- Maine
INSERT INTO interchanges (name, state_key, corridor, latitude, longitude, watch_radius_km, notify_states, detour_message, active) VALUES
('I-95 & I-295 (Portland, ME)', 'maine', 'I-95', 43.6591, -70.2568, 15, 'maine,newhampshire', 'Southern Maine junction.', 1);

-- Colorado
INSERT INTO interchanges (name, state_key, corridor, latitude, longitude, watch_radius_km, notify_states, detour_message, active) VALUES
('I-25 & I-70 (Denver, CO)', 'colorado', 'I-25', 39.7392, -104.9903, 15, 'colorado,wyoming,newmexico,kansas', 'Denver downtown - major junction.', 1),
('I-70 & I-76 (Denver, CO)', 'colorado', 'I-70', 39.7817, -104.8750, 15, 'colorado,nebraska,kansas', 'Northeast Denver.', 1);

-- Wyoming
INSERT INTO interchanges (name, state_key, corridor, latitude, longitude, watch_radius_km, notify_states, detour_message, active) VALUES
('I-25 & I-80 (Cheyenne, WY)', 'wyoming', 'I-25', 41.1400, -104.8202, 15, 'wyoming,colorado,nebraska', 'Southeast Wyoming junction.', 1);

-- New Mexico
INSERT INTO interchanges (name, state_key, corridor, latitude, longitude, watch_radius_km, notify_states, detour_message, active) VALUES
('I-25 & I-40 (Albuquerque, NM)', 'newmexico', 'I-25', 35.0844, -106.6504, 15, 'newmexico,colorado,texas,arizona', 'Albuquerque downtown - major junction.', 1);

-- Arizona
INSERT INTO interchanges (name, state_key, corridor, latitude, longitude, watch_radius_km, notify_states, detour_message, active) VALUES
('I-10 & I-17 (Phoenix, AZ)', 'arizona', 'I-10', 33.4484, -112.0740, 15, 'arizona,california,newmexico', 'Phoenix downtown.', 1),
('I-10 & I-19 (Tucson, AZ)', 'arizona', 'I-10', 32.2217, -110.9265, 15, 'arizona,newmexico', 'Tucson area - Mexico border route.', 1);

-- Texas
INSERT INTO interchanges (name, state_key, corridor, latitude, longitude, watch_radius_km, notify_states, detour_message, active) VALUES
('I-35 & I-635 (Dallas, TX)', 'texas', 'I-35', 32.7767, -96.7970, 15, 'texas,oklahoma,arkansas', 'Dallas area junction.', 1),
('I-10 & I-35 (San Antonio, TX)', 'texas', 'I-10', 29.4241, -98.4936, 15, 'texas,newmexico,louisiana', 'San Antonio junction.', 1),
('I-45 & I-10 (Houston, TX)', 'texas', 'I-45', 29.7604, -95.3698, 15, 'texas,louisiana', 'Houston downtown.', 1);

-- Oklahoma
INSERT INTO interchanges (name, state_key, corridor, latitude, longitude, watch_radius_km, notify_states, detour_message, active) VALUES
('I-35 & I-40 (Oklahoma City, OK)', 'oklahoma', 'I-35', 35.4676, -97.5164, 15, 'oklahoma,texas,kansas,arkansas', 'Oklahoma City downtown.', 1),
('I-44 & I-40 (Oklahoma City, OK)', 'oklahoma', 'I-44', 35.4676, -97.5164, 15, 'oklahoma,missouri,texas', 'OKC junction.', 1);

-- California
INSERT INTO interchanges (name, state_key, corridor, latitude, longitude, watch_radius_km, notify_states, detour_message, active) VALUES
('I-5 & I-10 (Los Angeles, CA)', 'california', 'I-5', 34.0522, -118.2437, 15, 'california,arizona,oregon', 'LA downtown junction.', 1),
('I-5 & I-80 (Sacramento, CA)', 'california', 'I-5', 38.5816, -121.4944, 15, 'california,oregon,nevada', 'Sacramento area.', 1),
('I-8 & I-15 (San Diego, CA)', 'california', 'I-8', 32.7157, -117.1611, 15, 'california,arizona', 'San Diego area.', 1);

-- Oregon
INSERT INTO interchanges (name, state_key, corridor, latitude, longitude, watch_radius_km, notify_states, detour_message, active) VALUES
('I-5 & I-84 (Portland, OR)', 'oregon', 'I-5', 45.5152, -122.6784, 15, 'oregon,washington,california,idaho', 'Portland downtown.', 1),
('I-84 & US-97 (Bend, OR)', 'oregon', 'I-84', 44.0582, -121.3153, 15, 'oregon,idaho', 'Central Oregon.', 1);

-- Washington
INSERT INTO interchanges (name, state_key, corridor, latitude, longitude, watch_radius_km, notify_states, detour_message, active) VALUES
('I-5 & I-90 (Seattle, WA)', 'washington', 'I-5', 47.6062, -122.3321, 15, 'washington,oregon,idaho', 'Seattle downtown - major junction.', 1),
('I-90 & I-82 (Ellensburg, WA)', 'washington', 'I-90', 46.9965, -120.5478, 15, 'washington,idaho,oregon', 'Central Washington.', 1);

-- Idaho
INSERT INTO interchanges (name, state_key, corridor, latitude, longitude, watch_radius_km, notify_states, detour_message, active) VALUES
('I-84 & I-184 (Boise, ID)', 'idaho', 'I-84', 43.6150, -116.2023, 15, 'idaho,oregon,montana,wyoming', 'Boise area.', 1),
('I-15 & I-86 (Pocatello, ID)', 'idaho', 'I-15', 42.8713, -112.4455, 15, 'idaho,montana,wyoming,utah', 'Southeast Idaho.', 1);

-- Montana
INSERT INTO interchanges (name, state_key, corridor, latitude, longitude, watch_radius_km, notify_states, detour_message, active) VALUES
('I-90 & I-15 (Butte, MT)', 'montana', 'I-90', 46.0038, -112.5348, 15, 'montana,idaho,wyoming', 'Southwest Montana junction.', 1);

-- North Dakota
INSERT INTO interchanges (name, state_key, corridor, latitude, longitude, watch_radius_km, notify_states, detour_message, active) VALUES
('I-94 & I-29 (Fargo, ND)', 'northdakota', 'I-94', 46.8772, -96.7898, 15, 'northdakota,minnesota,southdakota', 'Eastern ND junction.', 1);

-- South Dakota
INSERT INTO interchanges (name, state_key, corridor, latitude, longitude, watch_radius_km, notify_states, detour_message, active) VALUES
('I-90 & I-29 (Sioux Falls, SD)', 'southdakota', 'I-90', 43.5446, -96.7311, 15, 'southdakota,minnesota,iowa,northdakota', 'Southeast SD junction.', 1);

-- Alaska (limited interstates)
INSERT INTO interchanges (name, state_key, corridor, latitude, longitude, watch_radius_km, notify_states, detour_message, active) VALUES
('Glenn Hwy & Seward Hwy (Anchorage, AK)', 'alaska', 'Glenn Hwy', 61.2181, -149.9003, 15, 'alaska', 'Anchorage junction.', 1);

-- Hawaii (limited interstates)
INSERT INTO interchanges (name, state_key, corridor, latitude, longitude, watch_radius_km, notify_states, detour_message, active) VALUES
('H-1 & H-201 (Honolulu, HI)', 'hawaii', 'H-1', 21.3099, -157.8581, 15, 'hawaii', 'Honolulu area.', 1);
