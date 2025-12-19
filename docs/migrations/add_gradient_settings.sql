-- Migration: Add gradient background settings to user_settings table
-- Date: 2025-12-19
-- Description: Adds customizable gradient background colors and angle to user preferences

-- Add gradient columns to user_settings table
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS gradient_start_color TEXT DEFAULT '#d0dddf',
ADD COLUMN IF NOT EXISTS gradient_end_color TEXT DEFAULT '#dcfefb',
ADD COLUMN IF NOT EXISTS gradient_angle INTEGER DEFAULT 135 CHECK (gradient_angle >= 0 AND gradient_angle <= 360);

-- Update existing rows to have the default values
UPDATE user_settings
SET
  gradient_start_color = COALESCE(gradient_start_color, '#d0dddf'),
  gradient_end_color = COALESCE(gradient_end_color, '#dcfefb'),
  gradient_angle = COALESCE(gradient_angle, 135)
WHERE gradient_start_color IS NULL OR gradient_end_color IS NULL OR gradient_angle IS NULL;

-- Add comment to document the new columns
COMMENT ON COLUMN user_settings.gradient_start_color IS 'Starting color of the background gradient (hex format, e.g., #d0dddf)';
COMMENT ON COLUMN user_settings.gradient_end_color IS 'Ending color of the background gradient (hex format, e.g., #dcfefb)';
COMMENT ON COLUMN user_settings.gradient_angle IS 'Angle of the gradient in degrees (0-360, e.g., 135 for diagonal)';
