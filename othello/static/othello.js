/*global ko, $, Sammy*/
/*jslint browser: true, plusplus: true */
function boardItem(status, x, y) {
    "use strict";
    var self = this;
    self.status = ko.observable(status);
    self.x = ko.observable(x);
    self.y = ko.observable(y);
    self.mouseOver = ko.observable(false);
}

function algorithm(name, func_name, description) {
    "use strict";
    var self = this;
    self.name = name;
    self.func_name = func_name;
    self.description = description;
}

function OthelloModelView() {
    "use strict";
    var self = this,
        URIs,
        playresults,
        i,
        j,
        defaultMsgText = 'To save a game and return to it later just bookmark the page.  Should you wish to amend a move (or two) use the browser back button.',
        defaultMsgClass = 'alert alert-info',
        sammyApp;

    self.GameStateEnum = {
        NoGame: 0,
        UserToPlay: 1,
        WaitingServerResponse: 2,
        GameComplete: 3
    };

    // Board state
    self.board = ko.observableArray();
    for (i = 0; i < 6; i++) {
        for (j = 0; j < 6; j++) {
            self.board.push(new boardItem('', i, j));
        }
    }
    self.current_turn = ko.observable();
    self.pieceSize = ko.observable(500 / 6);
    self.boardSize = ko.observable(6);
    self.showPlays = ko.observable(false);
    self.gameState = ko.observable(self.GameStateEnum.NoGame);

    // Score board info
    self.blackScore = ko.observable();
    self.whiteScore = ko.observable();
    self.blackToPlay = ko.observable();
    self.gameComplete = ko.observable(false);

    //Message and warning info
    self.msgText = ko.observable(defaultMsgText);
    self.msgClass = ko.observable(defaultMsgClass);

    // New game option
    self.boardSizeOptions = [{size: 6, text: '6 x 6'}, {size: 8, text: '8 x 8'}, {size: 10, text: '10 x 10 (for the committed)'}];
    // Algorithm options
    self.algorithms = ko.observableArray();
    self.chosen_algorithm = ko.observable(new algorithm('Loading...', '', ''));

    self.turnText = ko.computed(function () {
        if (self.gameState() === self.GameStateEnum.NoGame) {
            return '';
        }
        if (self.gameState() === self.GameStateEnum.GameComplete) {
            return 'Game complete';
        }
        if (self.current_turn() === 'X') {
            return 'Black';
        }
        return 'White';
    });

    self.processResponse = function (data) {
        self.loadResponse(data);
        if (data.current_turn === 'O' && !data.game_complete) {
            self.gameState(self.GameStateEnum.WaitingServerResponse);
            $.ajax(data.URIs.play, {
                data: ko.toJSON({play: 'auto', strategy: self.chosen_algorithm().func_name}),
                type: "post",
                contentType: "application/json",
                success: self.processResponse
            });
        }
    };


    self.loadResponse = function (data) {
        var blackScore, whiteScore, tmp_board = [];

        if (data.hasOwnProperty('URIs')) {
            URIs = data.URIs;
        }
        if (data.hasOwnProperty('playresults')) {
            playresults = data.playresults;
        }
        self.current_turn(data.current_turn);
        self.boardSize(data.board.length);
        for (i = 0; i < data.board.length; i++) {
            for (j = 0; j < data.board.length; j++) {
                tmp_board.push(new boardItem(data.board[i][j], i, j));
            }
        }
        self.board(tmp_board);
        self.pieceSize(500 / data.board.length);
        blackScore = 0;
        whiteScore = 0;
        for (i = 0; i < data.board.length; i++) {
            for (j = 0; j < data.board.length; j++) {
                if (data.board[i][j] === 'X') {
                    blackScore += 1;
                }
                if (data.board[i][j] === 'O') {
                    whiteScore += 1;
                }
            }
        }
        self.blackScore(blackScore);
        self.whiteScore(whiteScore);

        if (data.game_complete) {
            if (self.blackScore() > self.whiteScore()) {
                self.msgText('Congratulations! You win by ' + String(self.blackScore() - self.whiteScore()) + ' points.');
                self.msgClass('alert alert-success');
            } else if (self.blackScore() < self.whiteScore()) {
                self.msgText('Game over. Computer wins by ' + String(self.whiteScore() - self.blackScore()) + ' points.');
                self.msgClass('alert alert-danger');
            } else {
                self.msgText('It\' a draw..');
                self.msgClass('alert alert-warning');
            }
        } else {
            self.msgText(defaultMsgText);
            self.msgClass(defaultMsgClass);
        }
        if (data.game_complete) {
            self.gameState(self.GameStateEnum.GameComplete);
        } else {
            self.gameState(self.GameStateEnum.UserToPlay);
        }
        location.hash = URIs.get;
    };

    self.getPieceColour = function (piece) {
        switch (piece.status()) {
        case 'X':
            return 'rgb(0,0,0)';
        case 'O':
            return 'rgb(200,200,200)';
        }
        if (piece.mouseOver() && self.gameState() === self.GameStateEnum.UserToPlay) {
            if (self.current_turn() === 'X') {
                return 'rgb(0,50,0)';
            }
            return 'rgb(150,200,150)';
        }
        if (piece.status() === 'P' && self.showPlays()) {
            return 'rgb(0,75,0)';
        }
        return 'rgb(0,100,0)';
    };

    self.clickPiece = function (b_item) {
        if (self.gameState() === self.GameStateEnum.UserToPlay) {
            if (b_item.status() === 'P') {
                self.msgText(defaultMsgText);
                self.msgClass(defaultMsgClass);
                self.loadResponse(playresults['(' + b_item.x() + ', ' + b_item.y() + ')']);
                self.gameState(self.GameStateEnum.WaitingServerResponse);
                $.ajax(URIs.play, {
                    data: ko.toJSON({play: [b_item.x(), b_item.y()]}),
                    type: "post",
                    contentType: "application/json",
                    success: self.processResponse
                });
            } else {
                self.msgText('Invalid move');
                self.msgClass('alert alert-danger');
            }
        }
    };


    self.newGame = function (size) {
        $.ajax('game', {
            data: ko.toJSON({game_size: size}),
            type: "post",
            contentType: "application/json",
            success: self.processResponse
        });
    };

    sammyApp = Sammy(function () {
        this.get(/\#([a-zA-Z0-9\/\-]*)$/, function () {
            if (self.gameState() === self.GameStateEnum.NoGame || this.params.splat.toString() !== URIs.get) {
                $.getJSON(this.params.splat, self.loadResponse);
            }
        });
    });
    sammyApp.run();

    self.loadAlgorithms = function (data) {
        var func_name;
        for (func_name in data) {
            if (data.hasOwnProperty(func_name)) {
                self.algorithms.push(new algorithm(data[func_name].nice_name, func_name, data[func_name].desc));
            }
        }
        self.chosen_algorithm(self.algorithms()[0]);
    };
    $.getJSON('game', self.loadAlgorithms);
}

ko.applyBindings(new OthelloModelView());
