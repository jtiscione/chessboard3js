$(function() {
    var engine = new Worker("js/lozza.js");
    console.log("GUI: uci");
    engine.postMessage("uci");
    console.log("GUI: ucinewgame");
    engine.postMessage("ucinewgame");

    var moveList = [], scoreList =[];

    var cursor = 0;

    var player = 'w';
    var entirePGN = ''; // longer than current PGN when rewind buttons are clicked

    var board;
    var game = new Chess(), // move validation, etc.
        statusEl = $('#status'),
        fenEl = $('#fen'),
        pgnEl = $('#pgn');

    // true for when the engine is processing; ignore_mouse_events is always true if this is set (also during animations)
    var engineRunning = false;

    // don't let the user press buttons while other button clicks are still processing
    var board3D = ChessBoard3.webGLEnabled();

    if (!board3D) {
        swal("WebGL unsupported or disabled.", "Using a 2D board...");
        $('#dimensionBtn').remove();
    }

    var scoreGauge = $('#gauge').SonicGauge({
        label:'WHITE\'S ADVANTAGE\n(centipawns)',
        start: {angle: -230, num: -2000},
        end: {angle: 50, num: 2000},
        markers: [
            {
                gap: 200,
                line: {"width" : 12, "stroke" : "none", "fill" : "#cccccc"},
                text: {"space": -22, "text-anchor" : "middle", "fill" : "#cccccc", "font-size" : 10}
            },
            {gap: 100, line: {"width" : 10, "stroke" : "none", "fill" : "#999999"}},
            {gap: 50, line: {"width" : 8, "stroke" : "none", "fill" : "#888888"}}
        ],
        animation_speed : 200,
        diameter : 300,
        style: {
            label: {
                "font-size": 12,
                fill: '#cccccc'
            },
            center: {
                fill: 'r#f46a3a-#890b0b'
            },
            outline: {
                fill: 'r#888888-#000000',
                stroke: 'black',
                'stroke-width' : 1
            }
        }
    });

    function updateScoreGauge(score) {
        scoreGauge.SonicGauge('val', parseInt(score, 10));
    }

    function adjustBoardWidth() {
        var fudge = 5;
        var windowWidth = $(window).width();
        var windowHeight = $(window).height();
        var desiredBoardWidth = windowWidth - $('#side').outerWidth(true) - fudge;
        var desiredBoardHeight = windowHeight - $('#header').outerHeight(true) - $('#banner').outerHeight(true) - $('#footer').outerHeight(true) - fudge;

        var boardDiv = $('#board');
        if (board3D) {
            // Using chessboard3.js.
            // Adjust for 4:3 aspect ratio
            desiredBoardWidth &= 0xFFFC; // mod 4 = 0
            desiredBoardHeight -= (desiredBoardHeight % 3); // mod 3 = 0
            if (desiredBoardWidth * 0.75 > desiredBoardHeight) {
                desiredBoardWidth = desiredBoardHeight * 4 / 3;
            }
            boardDiv.css('width', desiredBoardWidth);
            boardDiv.css('height', (desiredBoardWidth * 0.75));
        } else {
            // This is a chessboard.js board. Adjust for 1:1 aspect ratio
            desiredBoardWidth = Math.min(desiredBoardWidth, desiredBoardHeight);
            boardDiv.css('width', desiredBoardWidth);
            boardDiv.css('height', desiredBoardHeight);
        }
        if (board !== undefined) {
            board.resize();
        }
    }

    function fireEngine() {
        engineRunning = true;
        updateStatus();
        var currentScore;
        var msg = "position fen "+game.fen();
        console.log("GUI: "+msg);
        engine.postMessage(msg);
        msg = 'go movetime ' + $('#moveTime').val();
        console.log("GUI: "+msg);
        engine.postMessage(msg);
        engine.onmessage = function(event) {
            var line = event.data;
            console.log("ENGINE: "+line);
            var best = parseBestMove(line);
            if (best !== undefined) {
                var move = game.move(best);
                moveList.push(move);
                if (currentScore !== undefined) {
                    if (scoreList.length > 0) {
                        scoreList.pop(); // remove the dummy score for the user's prior move
                        scoreList.push(currentScore); // Replace it with the engine's opinion
                    }
                    scoreList.push(currentScore);// engine's response
                } else {
                    scoreList.push(0); // not expected
                }
                cursor++;
                board.position(game.fen(), true);
                engineRunning = false;
                updateStatus();
            } else {
                // Before the move gets here, the engine emits info responses with scores
                var score = parseScore(line);
                if (score !== undefined) {
                    if (player === 'w') {
                        score = -score; // convert from engine's score to white's score
                    }
                    updateScoreGauge(score);
                    currentScore = score;
                }
            }
        };
    }

    function parseBestMove(line) {
        var match = line.match(/bestmove\s([a-h][1-8][a-h][1-8])(n|N|b|B|r|R|q|Q)?/);
        if (match) {
            var bestMove = match[1];
            var promotion = match[2];
            return {
                from: bestMove.substring(0, 2),
                to: bestMove.substring(2, 4),
                promotion: promotion
            }
        }
    }

    function parseScore(line) {
        var match = line.match(/score\scp\s(-?\d+)/);
        if (match) {
            return match[1];
        } else {
            if (line.match(/mate\s-?\d/)) {
                return 2500;
            }
        }
    }

    function updateStatus() {

        var status = '';

        var moveColor = 'White';
        if (game.turn() === 'b') {
            moveColor = 'Black';
        }

        if (game.game_over()) {

            if (game.in_checkmate()) {
                status = moveColor + ' checkmated.';
            } else if (game.in_stalemate()) {
                status = moveColor + " stalemated";
            } else if (game.insufficient_material()) {
                status = "Draw (insufficient material)."
            } else if (game.in_threefold_repetition()) {
                status = "Draw (threefold repetition)."
            } else if (game.in_draw()) {
                status = "Game over (fifty move rule)."
            }
            swal({
                title : "Game Over",
                text : status,
                type: 'info',
                showCancelButton: false,
                confirmButtonColor: "#DD6655",
                onConfirmButtonText: 'OK',
                closeOnConfirm: true
            });
            engineRunning = false;
        }

        // game still on
        else {
            if (player === 'w') {
                status = "Computer playing Black; ";
            } else {
                status = "Computer playing White; ";
            }
            status += moveColor + ' to move.';

            // check?
            if (game.in_check() === true) {
                status += ' ' + moveColor + ' is in check.';
            }
        }

        fenEl.html(game.fen().replace(/ /g, '&nbsp;'));
        var currentPGN = game.pgn({max_width:10,newline_char:"<br>"});
        var matches = entirePGN.lastIndexOf(currentPGN, 0) === 0;
        if (matches) {
            currentPGN += "<span>" + entirePGN.substring(currentPGN.length, entirePGN.length) + "</span>";
        } else {
            entirePGN = currentPGN;
        }
        pgnEl.html(currentPGN);
        if (engineRunning) {
            status += ' Thinking...';
        }
        statusEl.html(status);
    };

    // Set up chessboard
    var onDrop = function(source, target) {
        if (engineRunning) {
            return 'snapback';
        }
        if (board.hasOwnProperty('removeGreySquares') && typeof board.removeGreySquares === 'function') {
            board.removeGreySquares();
        }

        // see if the move is legal
        var move = game.move({
            from: source,
            to: target,
            promotion: $("#promotion").val()
        });

        // illegal move
        if (move === null) return 'snapback';
        if (cursor === 0) {
            console.log("GUI: ucinewgame");
            engine.postMessage("ucinewgame");
        }
        moveList = moveList.slice(0, cursor);
        scoreList = scoreList.slice(0, cursor);
        moveList.push(move);
        // User just made a move- add a dummy score for now. We will correct this element once we hear from the engine
        scoreList.push(scoreList.length === 0 ? 0 : scoreList[scoreList.length - 1]);
        cursor = moveList.length;
    };

    // update the board position after the piece snap
    // for castling, en passant, pawn promotion
    var onSnapEnd = function() {
        if (!game.game_over() && game.turn() !== player) {
            fireEngine();
        }
    };

    var onMouseoverSquare = function(square) {
        // get list of possible moves for this square
        var moves = game.moves({
            square: square,
            verbose: true
        });

        // exit if there are no moves available for this square
        if (moves.length === 0) return;

        if (board.hasOwnProperty('greySquare') && typeof board.greySquare === 'function') {
            // highlight the square they moused over
            board.greySquare(square);

            // highlight the possible squares for this piece
            for (var i = 0; i < moves.length; i++) {
                board.greySquare(moves[i].to);
            }
        }
    };

    var onMouseoutSquare = function(square, piece) {
        if (board.hasOwnProperty('removeGreySquares') && typeof board.removeGreySquares === 'function') {
            board.removeGreySquares();
        }
    };

    function createBoard(pieceSet) {
        var cfg = {
            cameraControls: true,
            draggable: true,
            position: 'start',
            onDrop: onDrop,
            onMouseoutSquare: onMouseoutSquare,
            onMouseoverSquare: onMouseoverSquare,
            onSnapEnd: onSnapEnd
        };
        if (board3D) {
            if (pieceSet) {
                if (pieceSet === 'minions') {
                    cfg.whitePieceColor = 0xFFFF00;
                    cfg.blackPieceColor = 0xCC00CC;
                    cfg.lightSquareColor = 0x888888;
                    cfg.darkSquareColor = 0x666666;
                }
                cfg.pieceSet = 'assets/chesspieces/' + pieceSet + '/{piece}.json';
            }
            return new ChessBoard3('board', cfg);
        } else {
            return new ChessBoard('board', cfg);
        }
    }

    adjustBoardWidth();
    board = createBoard();

    $(window).resize(function() {
        adjustBoardWidth();
    });

    // Set up buttons
    $('#startBtn').on('click', function() {
        var cursorStart = 0;
        if (player === 'b') {
            cursorStart = 1;
        }
        while (cursor > cursorStart) {
            game.undo();
            cursor--;
        }
        updateScoreGauge(0);
        board.position(game.fen());
        updateStatus();
    });
    $('#backBtn').on('click', function() {
        if (cursor > 0) {
            cursor--;
            game.undo();
            board.position(game.fen());
            var score = cursor === 0 ? 0 : scoreList[cursor - 1];
            updateScoreGauge(score);
            updateStatus();
        }
    });
    $('#forwardBtn').on('click', function() {
        if (cursor < moveList.length) {
            game.move(moveList[cursor]);
            var score = scoreList[cursor];
            updateScoreGauge(score);
            board.position(game.fen());
            cursor++;
            updateStatus();
        }
    });
    $('#endBtn').on('click', function() {
        while (cursor < moveList.length) {
            game.move(moveList[cursor++]);
        }
        board.position(game.fen());
        updateScoreGauge(scoreList.length == 0 ? 0 : scoreList[cursor - 1]);
        updateStatus();
    });
    $('#hintBtn').on('click', function() {
        if (game.turn() === player) {
            engineRunning = true;
            var msg = "position fen " + game.fen();
            console.log("GUI: "+msg);
            engine.postMessage(msg);
            msg = 'go movetime ' + $('#moveTime').val();
            console.log(msg);
            engine.postMessage(msg);
            engine.onmessage = function (event) {
                console.log("ENGINE: "+event.data);
                var best = parseBestMove(event.data);
                if (best !== undefined) {
                    var currentFEN = game.fen();
                    game.move(best);
                    var hintedFEN = game.fen();
                    game.undo();
                    board.position(hintedFEN, true);
                    // give them a second to look before sliding the piece back
                    setTimeout(function() {
                        board.position(currentFEN, true);
                        engineRunning = false;
                    }, 1000); // give them a second to look
                }
            }
        }
    });
    $('#flipBtn').on('click', function() {
        if (game.game_over()) {
            return;
        }
        board.flip(); //wheeee!
        if (player === 'w') {
            player = 'b';
        } else {
            player = 'w';
        }
        updateStatus();
        setTimeout(fireEngine, 1000);
    });

    $('#dimensionBtn').on('click', function() {
        var dimBtn = $("#dimensionBtn");
        dimBtn.prop('disabled', true);
        var position = board.position();
        var orientation = board.orientation();
        board.destroy();
        board3D = !board3D;
        adjustBoardWidth();
        dimBtn.val(board3D? '2D' : '3D');
        setTimeout(function () {
            board = createBoard($('#piecesMenu').val());
            board.orientation(orientation);
            board.position(position);
            $("#dimensionBtn").prop('disabled', false);
        });
    });

    $("#setFEN").on('click', function(e) {
        swal({
            title: "SET FEN",
            text: "Enter a FEN position below:",
            type: "input",
            inputType: "text",
            showCancelButton: true,
            closeOnConfirm: false
        }, function(fen) {
            if (fen === false) {
                return; //cancel
            }
            fen = fen.trim();
            console.log(fen);
            var fenCheck = game.validate_fen(fen);
            console.log("valid: "+fenCheck.valid);
            if (fenCheck.valid) {
                game = new Chess(fen);
                console.log("GUI: ucinewgame");
                engine.postMessage('ucinewgame');
                console.log("GUI: position fen " + fen);
                engine.postMessage('position fen '+ fen);
                board.position(fen);
                fenEl.val(fen);
                pgnEl.empty();
                updateStatus();
                swal("Success", "FEN parsed successfully.", "success");
            } else {
                console.log(fenCheck.error);
                swal.showInputError("ERROR: "+fenCheck.error);
                return false;
            }
        });
    });

    $("#setPGN").on('click', (function(e) {
        swal({
            title: "SET PGN",
            text: "Enter a game PGN below:",
            type: "input",
            inputType: "text",
            showCancelButton: true,
            closeOnConfirm: false
        }, function(pgn) {
            if (pgn === false) {
                return; // cancel
            }
            pgn = pgn.trim();
            console.log(pgn);
            var pgnGame = new Chess();
            if (pgnGame.load_pgn(pgn)) {
                game = pgnGame;
                var fen = game.fen();
                console.log("GUI: ucinewgame");
                engine.postMessage('ucinewgame');
                console.log("GUI: position fen " + fen);
                engine.postMessage('position fen ' + game.fen());
                board.position(fen, false);
                fenEl.val(game.fen());
                pgnEl.empty();
                moveList = game.history();
                scoreList = [];
                for (var i = 0; i < moveList.length; i++) {
                    scoreList.push(0);
                }
                cursor = moveList.length;
                updateStatus();
                swal("Success", "PGN parsed successfully.", "success");
            } else {
                swal.showInputError("PGN not valid.");
                return false;
            }
        });
    }));

    $("#resetBtn").on('click', function(e) {
        player = 'w';
        game = new Chess();
        fenEl.empty();
        pgnEl.empty();
        largestPGN = '';
        moveList = [];
        scoreList = [];
        cursor = 0;
        board.start();
        board.orientation('white');
        console.log("GUI: ucinewgame");
        engine.postMessage('ucinewgame');
        updateScoreGauge(0);
    });

    $("#engineMenu").change(function() {
       console.log($("#engineMenu").val());
        if (engine) {
            var jsURL = $("#engineMenu").val();
            engine.terminate();
            engine = new Worker(jsURL);
            console.log("GUI: uci");
            engine.postMessage('uci');
            console.log("GUI: ucinewgame");
            engine.postMessage('ucinewgame');
            updateScoreGauge(0); // they each act a little differently
            if (jsURL.match(/p4wn/)) {
                swal('Using the tiny p4wn engine, which plays at an amateur level.');
            } else if (jsURL.match(/lozza/)) {
                swal('Using Lozza engine by Colin Jerkins, estimated rating 2340.')
            } else if (jsURL.match(/stockfish/)) {
                swal("Using stockfish engine, estimated rating > 3000.");
            }
        }
    });

    $('#piecesMenu').change(function() {
        var fen = board.position();
        board.destroy();
        board = createBoard($('#piecesMenu').val());
        board.position(fen);
        adjustBoardWidth();
    });

    updateStatus();
});

