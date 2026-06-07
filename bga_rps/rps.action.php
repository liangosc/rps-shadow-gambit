<?php
/**
 * ------
 * BGA rps.action.php for rps
 * ------
 */

class action_rps extends APP_GameAction
{ 
    public function __default()
    {
        if( self::isAjax() )
        {
            $gameaction = self::getNew("gameaction");
            $this->view = "rps_rps";
            self::trace( "action_rps __default gameaction: ".$gameaction );
        }
    }
    
    public function playCard()
    {
        self::setAjaxMode();     
        $type = self::getArg( "type", AT_alphanum, true );
        $index = self::getArg( "index", AT_posint, true );
        $choice = self::getArg( "choice", AT_alphanum, true );
        $this->game->playCard( $type, $index, $choice );
        self::ajaxResponse();
    }

    public function confirmDeployment()
    {
        self::setAjaxMode();     
        $this->game->confirmDeployment();
        self::ajaxResponse();
    }
}
