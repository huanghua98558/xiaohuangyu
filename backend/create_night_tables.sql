CREATE TABLE IF NOT EXISTS night_point_config (
  id INT PRIMARY KEY,
  time_start INT DEFAULT 0,
  time_end INT DEFAULT 8,
  base_coefficient DECIMAL(3,2) DEFAULT 1.4,
  max_coefficient DECIMAL(3,2) DEFAULT 1.8,
  no_accept_bonus DECIMAL(3,2) DEFAULT 0.1,
  is_active BOOL DEFAULT TRUE
);

INSERT INTO night_point_config (id, time_start, time_end, base_coefficient, max_coefficient, no_accept_bonus, is_active)
VALUES (1, 0, 8, 1.4, 1.8, 0.1, true)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS online_user_coefficient_map (
  id INT PRIMARY KEY,
  online_users_max INT NOT NULL,
  coefficient DECIMAL(3,2) NOT NULL,
  description TEXT,
  sort_order INT DEFAULT 0
);

INSERT INTO online_user_coefficient_map (online_users_max, coefficient, description, sort_order)
VALUES 
  (10, 1.75, '极少人在线，高激励', 1),
  (30, 1.65, '少量人在线，中高激励', 2),
  (50, 1.55, '中等在线，适度激励', 3),
  (100, 1.45, '较多在线，低激励', 4),
  (200, 1.40, '大量在线，基础激励', 5)
ON CONFLICT (id) DO NOTHING;

SELECT * FROM night_point_config;
SELECT * FROM online_user_coefficient_map ORDER BY sort_order;
