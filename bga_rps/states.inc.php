<?php
/**
 * ------
 * BGA states.inc.php for rps
 * ------
 */

$machinestates = array(
    // The initial state. Please do not modify.
    1 => array(
        "name" => "gameInit",
        "description" => "",
        "type" => "manager",
        "action" => "stGameInit",
        "transitions" => array( "" => 10 )
    ),
    
    // Player 1 setup phase (Gambit & Shadow lists)
    10 => array(
        "name" => "p1Setup",
        "description" => clienttranslate('${activeplayer} must deploy Gambit and Shadow lists'),
        "descriptionmyturn" => clienttranslate('${you} must deploy your Gambit and Shadow lists'),
        "type" => "activeplayer",
        "possibleactions" => array( "playCard", "confirmDeployment" ),
        "transitions" => array( "confirmP1" => 20, "zombiePass" => 20 )
    ),
    
    // Player 2 counter phase (Counter list)
    20 => array(
        "name" => "p2Setup",
        "description" => clienttranslate('${activeplayer} must deploy countermeasures'),
        "descriptionmyturn" => clienttranslate('${you} must deploy your countermeasures against the Gambit'),
        "type" => "activeplayer",
        "args" => "argP2Setup",
        "possibleactions" => array( "playCard", "confirmDeployment" ),
        "transitions" => array( "confirmP2" => 30, "zombiePass" => 30 )
    ),

    // Showdown calculation phase (Automated state)
    30 => array(
        "name" => "showdown",
        "description" => "",
        "type" => "game",
        "action" => "stShowdown",
        "transitions" => array( "endGame" => 99 )
    ),
   
    // The cleanup/end state. Please do not modify.
    99 => array(
        "name" => "gameEnd",
        "description" => clienttranslate("End of game"),
        "type" => "manager",
        "action" => "stGameEnd",
        "transitions" => array()
    )
);
