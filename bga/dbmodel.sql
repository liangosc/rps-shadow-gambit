-- ------
-- BGA dbmodel.sql for Shadow Gambit
-- ------

CREATE TABLE IF NOT EXISTS `slot` (
  `player_id` int(10) unsigned NOT NULL,
  `slot_type` varchar(16) NOT NULL, -- 'gambit', 'shadow', 'counter'
  `slot_index` tinyint(3) unsigned NOT NULL,
  `choice` varchar(16) DEFAULT NULL,
  PRIMARY KEY (`player_id`, `slot_type`, `slot_index`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
