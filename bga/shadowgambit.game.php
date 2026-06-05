<?php
/**
 * ------
 * BGA shadowgambit.game.php for Shadow Gambit
 * ------
 */

require_once( APP_GAMEMODULE_PATH.'module/table/table.class.php' );

class shadowgambit extends Table
{
    function __construct()
    {
        parent::__construct();
        
        self::initGameStateLabels( array() );
    }
    
    protected function getGameName()
    {
        return "shadowgambit";
    }

    protected function setupNewGame( $players, $options = array() )
    {
        // Set colors based on player setup
        $default_colors = array( "00f2fe", "ff007f" );
        
        $sql = "INSERT INTO player (player_id, player_color, player_canal, player_name, player_avatar) VALUES ";
        $values = array();
        $i = 0;
        foreach( $players as $player_id => $player )
        {
            $color = $default_colors[$i];
            $values[] = "('".$player_id."','$color','".$player['player_canal']."','".addslashes($player['player_name'])."','".addslashes($player['player_avatar'])."')";
            $i++;
        }
        $sql .= implode( ',', $values );
        self::DbQuery( $sql );
        
        self::reattributeColorsBasedOnPreferences( $players, $default_colors );
        self::reloadPlayersBasicInfo();
        
        // Initialize the slots table with null values for index 0..4
        $sql_slots = "INSERT INTO slot (player_id, slot_type, slot_index, choice) VALUES ";
        $slot_values = array();
        
        $p1_id = $this->getPlayer1Id();
        $p2_id = $this->getPlayer2Id();
        
        for ($idx = 0; $idx < 5; $idx++) {
            $slot_values[] = "('$p1_id', 'gambit', $idx, NULL)";
            $slot_values[] = "('$p1_id', 'shadow', $idx, NULL)";
            $slot_values[] = "('$p2_id', 'counter', $idx, NULL)";
        }
        
        $sql_slots .= implode( ',', $slot_values );
        self::DbQuery( $sql_slots );

        // Active Player 1
        $this->activeNextPlayer();
    }

    protected function getAllDatas()
    {
        $result = array();
    
        $current_player_id = self::getCurrentPlayerId();    
        $p1_id = $this->getPlayer1Id();
        $p2_id = $this->getPlayer2Id();

        // Load basic information about players
        $result['players'] = self::loadPlayersBasicInfo();
        $result['p1_id'] = $p1_id;
        $result['p2_id'] = $p2_id;

        // Retrieve current slot states from DB
        // Client only receives what they are permitted to see depending on role
        $result['p1Gambit'] = $this->getSlotsForPlayer($p1_id, 'gambit');
        
        if ($current_player_id == $p1_id) {
            $result['p1Shadow'] = $this->getSlotsForPlayer($p1_id, 'shadow');
        } else {
            // Player 2 gets an array filled with lock symbols to prevent cheat-peeking
            $result['p1Shadow'] = array_fill(0, 5, 'lock');
        }

        $result['p2Counter'] = $this->getSlotsForPlayer($p2_id, 'counter');
  
        return $result;
    }

    function getFormatGameProgression()
    {
        return 0; // Game resolves instantly or incrementally in one setup loop
    }

    // ==========================================================================
    // UTILITIES
    // ==========================================================================
    public function getPlayer1Id()
    {
        $players = self::loadPlayersBasicInfo();
        $ids = array_keys($players);
        return $ids[0];
    }

    public function getPlayer2Id()
    {
        $players = self::loadPlayersBasicInfo();
        $ids = array_keys($players);
        return $ids[1];
    }

    private function getSlotsForPlayer($player_id, $slot_type)
    {
        $sql = "SELECT slot_index, choice FROM slot WHERE player_id = '$player_id' AND slot_type = '$slot_type' ORDER BY slot_index ASC";
        $rows = self::getCollectionFromDb($sql);
        $choices = array();
        foreach ($rows as $row) {
            $choices[] = $row['choice'];
        }
        return $choices;
    }

    // ==========================================================================
    // GAME ACTIONS
    // ==========================================================================
    public function playCard($type, $index, $choice)
    {
        self::checkAction("playCard");
        
        $player_id = self::getActivePlayerId();
        $p1_id = $this->getPlayer1Id();
        $p2_id = $this->getPlayer2Id();

        // State-action validation
        $state = $this->gamestate->state();
        if ($state['name'] == 'p1Setup') {
            if ($player_id != $p1_id) {
                throw new feException("Only Player 1 can set up Gambit slots.");
            }
            if ($type != 'gambit' && $type != 'shadow') {
                throw new feException("Invalid slot type for Player 1.");
            }
        } else if ($state['name'] == 'p2Setup') {
            if ($player_id != $p2_id) {
                throw new feException("Only Player 2 can set up Counter slots.");
            }
            if ($type != 'counter') {
                throw new feException("Invalid slot type for Player 2.");
            }
        } else {
            throw new feException("You cannot select slots in the current game phase.");
        }

        if ($index < 0 || $index > 4) {
            throw new feException("Invalid slot index.");
        }
        if (!in_array($choice, array('rock', 'paper', 'scissors'))) {
            throw new feException("Invalid card selection.");
        }

        // Persist move
        $sql = "UPDATE slot SET choice = '$choice' WHERE player_id = '$player_id' AND slot_type = '$type' AND slot_index = '$index'";
        self::DbQuery($sql);

        // Send confirmation back to the active player client
        self::notifyPlayer($player_id, "cardRegistered", "", array(
            'type' => $type,
            'index' => $index,
            'choice' => $choice
        ));
    }

    public function confirmDeployment()
    {
        self::checkAction("confirmDeployment");

        $player_id = self::getActivePlayerId();
        $p1_id = $this->getPlayer1Id();
        $p2_id = $this->getPlayer2Id();
        $state = $this->gamestate->state();

        if ($state['name'] == 'p1Setup') {
            // Verify P1 lists are completely populated
            $gambits = $this->getSlotsForPlayer($p1_id, 'gambit');
            $shadows = $this->getSlotsForPlayer($p1_id, 'shadow');
            
            if (in_array(null, $gambits) || in_array(null, $shadows)) {
                throw new feException("All Gambit and Shadow slots must be deployed before confirmation.");
            }

            // Notify P2 that P1 is locked and ready. Send P1's Gambit choices publicly.
            self::notifyAllPlayers("p1Deployed", clienttranslate('Player 1 has locked in their deployment configurations.'), array(
                'p1Gambit' => $gambits
            ));

            // Set P2 active and transition
            $this->gamestate->changeActivePlayer($p2_id);
            $this->gamestate->nextState("confirmP1");

        } else if ($state['name'] == 'p2Setup') {
            // Verify P2 Counter is completely populated
            $counters = $this->getSlotsForPlayer($p2_id, 'counter');
            
            if (in_array(null, $counters)) {
                throw new feException("All Counter slots must be deployed before engaging showdown.");
            }

            // Transition directly to automated showdown state
            $this->gamestate->nextState("confirmP2");
        }
    }

    // ==========================================================================
    // AUTOMATED STATE LOGIC
    // ==========================================================================
    public function argP2Setup()
    {
        $p1_id = $this->getPlayer1Id();
        return array(
            'p1Gambit' => $this->getSlotsForPlayer($p1_id, 'gambit')
        );
    }

    public function stShowdown()
    {
        $p1_id = $this->getPlayer1Id();
        $p2_id = $this->getPlayer2Id();

        $p1Shadow = $this->getSlotsForPlayer($p1_id, 'shadow');
        $p2Counter = $this->getSlotsForPlayer($p2_id, 'counter');

        $scores = array('p1' => 0, 'p2' => 0);
        $rounds = array();

        for ($i = 0; $i < 5; $i++) {
            $p1Choice = $p1Shadow[$i];
            $p2Choice = $p2Counter[$i];
            
            if ($p1Choice == $p2Choice) {
                $winner = 'tie';
            } else if (
                ($p1Choice == 'rock' && $p2Choice == 'scissors') ||
                ($p1Choice == 'paper' && $p2Choice == 'rock') ||
                ($p1Choice == 'scissors' && $p2Choice == 'paper')
            ) {
                $winner = 'p1';
                $scores['p1']++;
            } else {
                $winner = 'p2';
                $scores['p2']++;
            }
            $rounds[] = $winner;
        }

        // Write scores to database
        $sql1 = "UPDATE player SET player_score = " . $scores['p1'] . " WHERE player_id = '$p1_id'";
        $sql2 = "UPDATE player SET player_score = " . $scores['p2'] . " WHERE player_id = '$p2_id'";
        self::DbQuery($sql1);
        self::DbQuery($sql2);

        // Notify both clients of the results and expose the secret Shadow list
        self::notifyAllPlayers("showdownResolved", "", array(
            'p1Shadow' => $p1Shadow,
            'p2Counter' => $p2Counter,
            'rounds' => $rounds,
            'scores' => $scores
        ));

        // Advance to End Game
        $this->gamestate->nextState("endGame");
    }

    // ==========================================================================
    // ZOMBIE / DISCONNECT METHODS
    // ==========================================================================
    protected function getGameInfos() {
        return array();
    }
    
    function upgradeTableDb( $from_version ) {}
    
    protected function handleZombie($active_player, $state) {
        $this->gamestate->nextState("zombiePass");
    }
}
