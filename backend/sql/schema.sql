-- CampusPulse schema for MonetDB
-- The seed script drops/recreates this table for the demo.
CREATE TABLE energy_readings (
  reading_id INT NOT NULL,
  building_name VARCHAR(80) NOT NULL,
  recorded_at TIMESTAMP NOT NULL,
  energy_kwh DOUBLE NOT NULL,
  data_source VARCHAR(20) NOT NULL
);