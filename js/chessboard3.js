/**
 * chessboard3.js version 0.1.2
 *
 * Copyright 2016 Jason Tiscione
 * Portions copyright 2013 Chris Oakman
 * Released under MIT license
 * https://github.com/jtiscione/chessboard3js/blob/master/LICENSE
 */
;(function() {
    'use strict';

    // ---------------------------------------------------------------------//
    //                               CONSTANTS                              //
    // ---------------------------------------------------------------------//
    var MINIMUM_THREEJS_REVISION = 71;
    var START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
    var COLUMNS = "abcdefgh".split('');
    var LIGHT_POSITIONS = [
        [50, 40, 30],
        [-50, 0, -30] // place at y=0 to avoid double phong reflection off the board
    ];
    var SQUARE_SIZE = 2;
    var CAMERA_POLAR_ANGLE = Math.PI / 4;
    var CAMERA_DISTANCE = 18.25;
    var SPARE_POSITION = {
        sw1 : 'wK', sw2: 'wQ', sw3: 'wR', sw4: 'wB', sw5: 'wN', sw6: 'wP',
        sb1 : 'bK', sb2: 'bQ', sb3: 'bR', sb4: 'bB', sb5: 'bN', sb6: 'bP'
    };
    var ASPECT_RATIO = 0.75;

    // ---------------------------------------------------------------------//
    //                               ANIMATION                              //
    // ---------------------------------------------------------------------//

    var executingTweens = [];

    function startTween(onUpdate, onComplete, duration) {
        executingTweens.push({
            onUpdate: onUpdate,
            onComplete: onComplete,
            duration: duration,
            started: window.performance.now()
        });
        onUpdate(0);
    }

    // invoke frequently
    function updateAllTweens() {
        var tweenArray = [];
        executingTweens.forEach(function(tween) {
            var rightNow = window.performance.now();
            var t = (rightNow - tween.started) / tween.duration;
            if (t < 1) {
                tween.onUpdate(t);
                tweenArray.push(tween);
            } else {
                tween.onUpdate(1.0);
                tween.onComplete();
            }
        });
        executingTweens = tweenArray;
    }

    // ---------------------------------------------------------------------//
    //                               UTILITIES                              //
    // ---------------------------------------------------------------------//

    function webGLEnabled() {
        try {
            var canvas = document.createElement( 'canvas' );
            return !! (
                    (window.hasOwnProperty('WebGLRenderingContext') && window.WebGLRenderingContext)
                     &&
                    ( canvas.getContext( 'webgl' ) || canvas.getContext( 'experimental-webgl')
                )
            );
        }
        catch ( e ) {
            return false;
        }
    }

    function deepCopy(thing) {
        return JSON.parse(JSON.stringify(thing));
    }

    function validMove(move) {
        if (typeof move !== 'string') {
            return false;
        }
        var tmp = move.split('-');
        if (tmp.length !== 2) {
            return false;
        }
        return validSquare(tmp[0]) && validSquare(tmp[1]);
    }

    function validSquare(square) {
        return validOrdinarySquare(square) || validSpareSquare(square);
    }

    function validOrdinarySquare(square) {
        if (typeof square !== 'string') return false;
        return (square.search(/^[a-h][1-8]$/) !== -1);
    }

    function validSpareSquare(square) {
        if (typeof square !== 'string') return false;
        return (square.search(/^s[bw][1-6]$/) !== -1);
    }

    function validPieceCode(code) {
        if (typeof code !== 'string') {
            return false;
        }
        return (code.search(/^[bw][KQRNBP]$/) !== -1);
    }

    function validFen(fen) {
        if (typeof fen !== 'string') {
            return false;
        }
        // cut off any move, castling, etc info from the end
        // we're only interested in position information
        fen = fen.replace(/ .+$/, '');

        // FEN should be 8 sections separated by slashes
        var chunks = fen.split('/');
        if (chunks.length !== 8) return false;

        // check the piece sections
        for (var i = 0; i < 8; i++) {
            if (chunks[i] === '' ||
                chunks[i].length > 8 ||
                chunks[i].search(/[^kqrbnpKQRNBP1-8]/) !== -1) {
                return false;
            }
        }

        return true;
    }

    function validPositionObject(pos) {
        if (typeof pos !== 'object') return false;

        for (var i in pos) {
            if (pos.hasOwnProperty(i) !== true) continue;
            if (validSquare(i) !== true || validPieceCode(pos[i]) !== true) {
                return false;
            }
        }

        return true;
    }
    // convert FEN piece code to bP, wK, etc
    function fenToPieceCode(piece) {
        // black piece
        if (piece.toLowerCase() === piece) {
            return 'b' + piece.toUpperCase();
        }

        // white piece
        return 'w' + piece.toUpperCase();
    }

    // convert bP, wK, etc code to FEN structure
    function pieceCodeToFen(piece) {
        var tmp = piece.split('');

        // white piece
        if (tmp[0] === 'w') {
            return tmp[1].toUpperCase();
        }

        // black piece
        return tmp[1].toLowerCase();
    }
    // convert FEN string to position object
    // returns false if the FEN string is invalid
    function fenToObj(fen) {
        if (validFen(fen) !== true) {
            return false;
        }

        // cut off any move, castling, etc info from the end
        // we're only interested in position information
        fen = fen.replace(/ .+$/, '');

        var rows = fen.split('/');
        var position = {};

        var currentRow = 8;
        for (var i = 0; i < 8; i++) {
            var row = rows[i].split('');
            var colIndex = 0;

            // loop through each character in the FEN section
            for (var j = 0; j < row.length; j++) {
                // number / empty squares
                if (row[j].search(/[1-8]/) !== -1) {
                    colIndex += parseInt(row[j], 10);
                }
                // piece
                else {
                    var square = COLUMNS[colIndex] + currentRow;
                    position[square] = fenToPieceCode(row[j]);
                    colIndex++;
                }
            }

            currentRow--;
        }

        return position;
    }

    // position object to FEN string
    // returns false if the obj is not a valid position object
    function objToFen(obj) {
        if (validPositionObject(obj) !== true) {
            return false;
        }

        var fen = '';

        var currentRow = 8;
        for (var i = 0; i < 8; i++) {
            for (var j = 0; j < 8; j++) {
                var square = COLUMNS[j] + currentRow;

                // piece exists
                if (obj.hasOwnProperty(square) === true) {
                    fen += pieceCodeToFen(obj[square]);
                }

                // empty space
                else {
                    fen += '1';
                }
            }

            if (i !== 7) {
                fen += '/';
            }

            currentRow--;
        }

        fen = fen.replace(/11111111/g, '8');
        fen = fen.replace(/1111111/g, '7');
        fen = fen.replace(/111111/g, '6');
        fen = fen.replace(/11111/g, '5');
        fen = fen.replace(/1111/g, '4');
        fen = fen.replace(/111/g, '3');
        fen = fen.replace(/11/g, '2');

        return fen;
    }

    // ---------------------------------------------------------------------//
    //                           WIDGET DEFINITION                          //
    // ---------------------------------------------------------------------//

    window['ChessBoard3'] = window['ChessBoard3'] || function(containerElOrId, cfg) {

            cfg = cfg || {};

            var START_POSITION = fenToObj(START_FEN);

            var containerEl;
            var addedToContainer = false;

            var widget = {};

            var RENDERER, SCENE, LABELS, CAMERA, CAMERA_CONTROLS;

            var CAMERA_POSITION_WHITE = new THREE.Vector3(0,
                CAMERA_DISTANCE * Math.cos(CAMERA_POLAR_ANGLE),
                CAMERA_DISTANCE * Math.sin(CAMERA_POLAR_ANGLE));
            var CAMERA_POSITION_BLACK = new THREE.Vector3(0,
                CAMERA_DISTANCE * Math.cos(CAMERA_POLAR_ANGLE),
                -CAMERA_DISTANCE * Math.sin(CAMERA_POLAR_ANGLE));

            var whitePieceColor = 0xAAAAAA;
            if (cfg.hasOwnProperty('whitePieceColor') && typeof cfg.whitePieceColor === 'number') {
                whitePieceColor = cfg.whitePieceColor;
            }
            var WHITE_MATERIAL = new THREE.MeshPhongMaterial({color: new THREE.Color(whitePieceColor)});

            var whitePieceSpecular = 0xCCFFFF;
            if (cfg.hasOwnProperty('whitePieceSpecular') && typeof cfg.whitePieceSpecular === 'number') {
                whitePieceSpecular = cfg.whitePieceSpecular;
            }
            WHITE_MATERIAL.specular = new THREE.Color(whitePieceSpecular);
            WHITE_MATERIAL.transparent = true;

            var blackPieceColor = 0x333333;
            if (cfg.hasOwnProperty('blackPieceColor') && typeof cfg.blackPieceColor === 'number') {
                blackPieceColor = cfg.blackPieceColor;
            }
            var BLACK_MATERIAL = new THREE.MeshPhongMaterial({color: new THREE.Color(blackPieceColor)});

            var blackPieceSpecular = 0x553333;
            if (cfg.hasOwnProperty('blackPieceSpecular') && typeof cfg.blackPieceSpecular === 'number') {
                blackPieceSpecular = cfg.blackPieceSpecular;
            }
            BLACK_MATERIAL.specular = new THREE.Color(blackPieceSpecular);
            BLACK_MATERIAL.transparent = true;

            var textColor = 0x000000;
            if (cfg.hasOwnProperty('notationColor') && typeof cfg.notationColor === 'number') {
                textColor = cfg.notationColor;
            }
            var textMaterial = new THREE.MeshBasicMaterial({color: new THREE.Color(textColor)});
            textMaterial.transparent = true;

            var RANK_1_TEXT_MATERIAL = textMaterial.clone();
            var RANK_8_TEXT_MATERIAL = textMaterial.clone();
            var FILE_A_TEXT_MATERIAL = textMaterial.clone();
            var FILE_H_TEXT_MATERIAL = textMaterial.clone();

            var darkSquareColor = 0xb68863;
            if (cfg.hasOwnProperty('darkSquareColor') && typeof cfg.darkSquareColor === 'number') {
                darkSquareColor = cfg.darkSquareColor;
            }
            var darkSquareMaterial = new THREE.MeshPhongMaterial({color: new THREE.Color(darkSquareColor)});

            var lightSquareColor= 0xf0d9b5;
            if (cfg.hasOwnProperty('lightSquareColor') && typeof cfg.lightSquareColor === 'number') {
                lightSquareColor = cfg.lightSquareColor;
            }
            var lightSquareMaterial = new THREE.MeshPhongMaterial({color: new THREE.Color(lightSquareColor)});
            /*
            darkSquareMaterial.specularMap = THREE.ImageUtils.loadTexture("img/iris.png", undefined, function() {SPECULAR_MAPS_PENDING--;};);
            lightSquareMaterial.specularMap = THREE.ImageUtils.loadTexture("img/grain.jpg", undefined, function() {SPECULAR_MAPS_PENDING--;};);
            */

            var GEOMETRIES = {
                K: undefined,
                Q: undefined,
                R: undefined,
                B: undefined,
                N: undefined,
                P: undefined
            };

            //------------------------------------------------------------------------------
            // Stateful
            //------------------------------------------------------------------------------

            var ANIMATION_HAPPENING = false,
                RENDER_FLAG = true,
                CURRENT_ORIENTATION = 'white',
                CURRENT_POSITION = {},
                SQUARE_MESH_IDS = {},
                PIECE_MESH_IDS = {},
                DRAG_INFO = null,
                SOURCE_SQUARE_HIGHLIGHT_MESH = null,
                DESTINATION_SQUARE_HIGHLIGHT_MESH = null,
                USER_HIGHLIGHT_MESHES = [],
                MOUSEOVER_SQUARE = 'offboard';

            //--------------------
            // Validation / Errors
            //--------------------

            function error(code, msg, obj) {
                // do nothing if showErrors is not set
                var showErrors = cfg['showErrors'];
                if (cfg.hasOwnProperty('showErrors') !== true ||
                    cfg['showErrors'] === false) {
                    return;
                }

                var errorText = 'ChessBoard3 Error ' + code + ': ' + msg;

                // print to console
                if (cfg.hasOwnProperty('showErrors') && cfg['showErrors']=== 'console' &&
                    typeof console === 'object' &&
                    typeof console.log === 'function') {
                    console.log(errorText);
                    if (arguments.length >= 2) {
                        console.log(obj);
                    }
                    return;
                }

                if (cfg['showErrors'] === 'alert') {
                    if (obj) {
                        errorText += '\n\n' + JSON.stringify(obj);
                    }
                    window.alert(errorText);
                    return;
                }

                // custom function
                if (typeof cfg['showErrors'] === 'function') {
                    cfg['showErrors'].call(code, msg, obj);
                }
            }

            function checkDeps() {
                // Check for three.js
                if (THREE === undefined || THREE.REVISION === undefined
                    || isNaN(parseInt(THREE.REVISION))
                    || (parseInt(THREE.REVISION) < MINIMUM_THREEJS_REVISION)) {
                    console.log("ChessBoard3 Error 3006: Unable to find three.js revision 71 or greater. \n\nExiting...");
                    return false;
                }
                if (!webGLEnabled()) {
                    window.alert("ChessBoard3 Error 3001: WebGL is not enabled.\n\nExiting...");
                    return false;
                }
                if (typeof containerElOrId === 'string') {
                    if (containerElOrId === '') {
                        window.alert('ChessBoard3 Error 1001: The first argument to ChessBoard3() cannot be an empty string.\n\nExiting...');
                        return false;
                    }
                    var el = document.getElementById(containerElOrId);
                    if (!el) {
                        window.alert('ChessBoard Error 1002: Element with id "' + containerElOrId + '"does not exist in the DOM.\n\nExiting...');
                        return false;
                    }
                    containerEl = el;
                } else {
                    containerEl = containerElOrId;
                    if (containerEl.length !== -1) {
                        window.alert("ChessBoard3 Error 1003: The first argument to ChessBoard3() must be an ID or a single DOM node.\n\nExiting...");
                        return false;
                    }
                }
                return true;
            }

            function validAnimationSpeed(speed) {
                if (speed === 'fast' || speed === 'slow') {
                    return true;
                }

                if ((parseInt(speed, 10) + '') !== (speed + '')) {
                    return false;
                }

                return (speed >= 0);
            }


            // validate config / set default options
            function expandConfig() {
                if (typeof cfg === 'string' || validPositionObject(cfg)) {
                    cfg = {
                        position: cfg
                    };
                }

                if (cfg.orientation !== 'black') {
                    cfg.orientation = 'white'
                }
                CURRENT_ORIENTATION = cfg.orientation;

                if (cfg.showNotation !== false) {
                    cfg.showNotation = true;
                    if (cfg.hasOwnProperty('fontData') !== true ||
                        (typeof cfg.fontData !== 'string' && typeof cfg.fontData !== 'function')) {
                        cfg.fontData = 'assets/fonts/helvetiker_regular.typeface.json';
                    }
                }

                if (cfg.draggable !== true) {
                    cfg.draggable = false;
                }

                if (cfg.dropOffBoard !== 'trash') {
                    cfg.dropOffBoard = 'snapback';
                }

                if (cfg.sparePieces !== true) {
                    cfg.sparePieces = false;
                }

                // draggable must be true if sparePieces is enabled
                if (cfg.sparePieces === true) {
                    cfg.draggable = true;
                }

                // default chess set
                if (cfg.hasOwnProperty('pieceSet') !== true ||
                    (typeof cfg.pieceSet !== 'string' &&
                    typeof cfg.pieceSet !== 'function')) {
                    cfg.pieceSet = 'assets/chesspieces/iconic/{piece}.json';
                }

                // rotate and zoom controls
                if (cfg.rotateControls !== false) {
                    cfg.rotateControls = true;
                }
                if (cfg.zoomControls !== true) {
                    cfg.zoomControls = false;
                }


                // animation speeds
                if (cfg.hasOwnProperty('appearSpeed') !== true ||
                    validAnimationSpeed(cfg.appearSpeed) !== true) {
                    cfg.appearSpeed = 200;
                } else if (cfg.hasOwnProperty('appearSpeed')) {
                    if (cfg.appearSpeed === 'slow') {
                        cfg.appearSpeed = 400;
                    } else if (cfg.appearSpeed === 'fast') {
                        cfg.appearSpeed = 100;
                    }
                }
                if (cfg.hasOwnProperty('moveSpeed') !== true ||
                    validAnimationSpeed(cfg.moveSpeed) !== true) {
                    cfg.moveSpeed = 200;
                } else if (cfg.hasOwnProperty('moveSpeed')) {
                    if (cfg.moveSpeed === 'slow') {
                        cfg.moveSpeed = 400;
                    } else if (cfg.moveSpeed === 'fast') {
                        cfg.moveSpeed = 100;
                    }
                }
                if (cfg.hasOwnProperty('snapbackSpeed') !== true ||
                    validAnimationSpeed(cfg.snapbackSpeed) !== true) {
                    cfg.snapbackSpeed = 50;
                } else if (cfg.hasOwnProperty('snapbackSpeed')) {
                    if (cfg.snapbackSpeed === 'slow') {
                        cfg.snapbackSpeed = 100;
                    } else if (cfg.snapbackSpeed === 'fast') {
                        cfg.snapbackSpeed = 25;
                    }
                }
                if (cfg.hasOwnProperty('snapSpeed') !== true ||
                    validAnimationSpeed(cfg.snapSpeed) !== true) {
                    cfg.snapSpeed = 25;
                } else if (cfg.hasOwnProperty('snapSpeed')) {
                    if (cfg.snapSpeed === 'slow') {
                        cfg.snapSpeed = 50;
                    } else if (cfg.snapSpeed === 'fast') {
                        cfg.snapSpeed = 10;
                    }
                }
                if (cfg.hasOwnProperty('trashSpeed') !== true ||
                    validAnimationSpeed(cfg.trashSpeed) !== true) {
                    cfg.trashSpeed = 100;
                } else if (cfg.hasOwnProperty('trashSpeed')) {
                    if (cfg.trashSpeed === 'slow') {
                        cfg.trashSpeed = 200;
                    } else if (cfg.trashSpeed === 'fast') {
                        cfg.trashSpeed = 50;
                    }
                }

                // make sure position is valid
                if (cfg.hasOwnProperty('position') === true) {
                    if (cfg.position === 'start') {
                        CURRENT_POSITION = deepCopy(START_POSITION);
                    }
                    else if (validFen(cfg.position) === true) {
                        CURRENT_POSITION = fenToObj(cfg.position);
                    }
                    else if (validPositionObject(cfg.position) === true) {
                        CURRENT_POSITION = deepCopy(cfg.position);
                    }
                    else {
                        error(7263, 'Invalid value passed to config.position.', cfg.position);
                    }
                }
                return true;
            }

            // three.js scene construction (sans pieces)
            function prepareScene() {

                if (cfg.orientation !== 'black') {
                    cfg.orientation = 'white';
                }

                //window.WebGLRenderingContext ? new THREE.WebGLRenderer() : new THREE.CanvasRenderer();
                RENDERER = new THREE.WebGLRenderer({
                    alpha: true,
                    preserveDrawingBuffer: true,
                    antialias: true,
                    transparent: true
                });

                var backgroundColor;
                if (cfg.hasOwnProperty('backgroundColor') && typeof cfg.backgroundColor === 'number') {
                    backgroundColor = cfg.backgroundColor;
                } else {
                    backgroundColor = 0xBBBBBB;
                }
                RENDERER.setClearColor(backgroundColor, 1);

                RENDERER.setSize(containerEl.clientWidth, Math.round(containerEl.clientWidth * ASPECT_RATIO));

                SCENE = new THREE.Scene();
                //SCENE.add(new THREE.AxisHelper(3));

                CAMERA = new THREE.PerspectiveCamera(60, containerEl.clientWidth / containerEl.clientHeight, 0.1, 1000);
                CAMERA.aspectRatio = ASPECT_RATIO;

                if (cfg.sparePieces === false) {
                    // no spare pieces, so let's pull a bit closer with this hack
                    CAMERA_POSITION_WHITE.multiplyScalar(0.9);
                    CAMERA_POSITION_BLACK.multiplyScalar(0.9);
                }
                if (cfg.orientation === 'white') {
                    CAMERA.position.set(CAMERA_POSITION_WHITE.x, CAMERA_POSITION_WHITE.y, CAMERA_POSITION_WHITE.z);
                } else if (cfg.orientation === 'black') {
                    CAMERA.position.set(CAMERA_POSITION_BLACK.x, CAMERA_POSITION_BLACK.y, CAMERA_POSITION_BLACK.z);
                }

                CAMERA.lookAt(new THREE.Vector3(0, -3, 0));

                SCENE.add(CAMERA);

                RENDERER.domElement.addEventListener( 'mousedown', mouseDown, true );
                RENDERER.domElement.addEventListener( 'mousemove', mouseMove, true);
                RENDERER.domElement.addEventListener( 'mouseup', mouseUp, true);


                if ('ontouchstart' in document.documentElement) {
                    RENDERER.domElement.addEventListener('touchstart', function(e) {
                        mouseDown(e, true);
                    }, true);
                    RENDERER.domElement.addEventListener('touchmove', function(e) {
                        mouseMove(e, true);
                    }, true);
                    RENDERER.domElement.addEventListener('touchend', mouseUp, true);
                }

                if (cfg.rotateControls || cfg.zoomControls) {
                    if (THREE.OrbitControls !== undefined) {
                        CAMERA_CONTROLS = new THREE.OrbitControls(CAMERA, RENDERER.domElement, RENDERER.domElement);
                        CAMERA_CONTROLS.enablePan = false;
                        if (cfg.rotateControls) {
                            CAMERA_CONTROLS.minPolarAngle = Math.PI / 2 * 0.1;
                            CAMERA_CONTROLS.maxPolarAngle = Math.PI / 2 * 0.8;
                        } else {
                            CAMERA_CONTROLS.noRotate = true;
                        }
                        if (cfg.zoomControls) {
                            CAMERA_CONTROLS.minDistance = 12;
                            CAMERA_CONTROLS.maxDistance = 22;
                            CAMERA_CONTROLS.enableZoom = true;
                        } else {
                            CAMERA_CONTROLS.enableZoom = false;
                        }
                        CAMERA_CONTROLS.target.y = -3;
                        CAMERA_CONTROLS.enabled = true;
                    }
                }
            }

            function swivelCamera(targetPosition) {
                ANIMATION_HAPPENING = true;
                var startPosition = CAMERA.position;
                var startY = startPosition.y, targetY = targetPosition.y;
                var startRadius = Math.sqrt(Math.pow(startPosition.x, 2) + Math.pow(startPosition.z, 2));
                var targetRadius =  Math.sqrt(Math.pow(targetPosition.x, 2) + Math.pow(targetPosition.z, 2));
                var startTheta = Math.acos(startPosition.x / startRadius);
                var targetTheta = Math.acos(targetPosition.x / targetRadius);
                if (startPosition.z < 0) {
                    startTheta = -startTheta;
                }
                if (targetPosition.z < 0) {
                    targetTheta = -targetTheta;
                }
                if (targetTheta - startTheta >= Math.PI || startTheta - targetTheta > Math.PI) {
                    if (targetTheta > startTheta) {
                        targetTheta -= 2 * Math.PI;
                    } else {
                        targetTheta += 2 * Math.PI;
                    }
                }

                var end = function() {
                    CAMERA.position.set(targetPosition.x, targetPosition.y, targetPosition.z);
                    CAMERA.lookAt(new THREE.Vector3(0, -3, 0));
                    ANIMATION_HAPPENING = false;
                    RENDER_FLAG = true;
                };

                startTween(function(t) {
                    var theta = startTheta + t * (targetTheta - startTheta);
                    var r = startRadius + t * (targetRadius - startRadius);
                    CAMERA.position.set(r * Math.cos(theta),
                        startY + t * (targetY - startY),
                        r * Math.sin(theta));
                    CAMERA.lookAt(new THREE.Vector3(0, -3, 0));
                }, end, 1000);
            }

            function buildPieceMesh(square, piece) {

                var coords = squareCoordinates(square);

                var color = piece.charAt(0);
                var species = piece.charAt(1);

                var material;
                if (color === 'w') {
                    material = WHITE_MATERIAL.clone();
                } else if (color === 'b') {
                    material = BLACK_MATERIAL.clone();
                }

                var geometry, mesh;
                geometry = GEOMETRIES[species];
                mesh = new THREE.Mesh(geometry, material);
                mesh.position.x = coords.x;
                mesh.position.z = coords.z;
                if (color === 'w') {
                    mesh.rotation.y = Math.PI;
                }
                mesh.castShadow = true;
                return mesh;
            }

            function addLabelsToScene() {

                var loader = new THREE.FontLoader();

                var url = null;
                if (typeof cfg.fontData === 'function') {
                    url = cfg.fontData();
                } else if (typeof cfg.fontData === 'string') {
                    url = cfg.fontData;
                }

                if (url === null) {
                    cfg.showNotation = false;
                    error(2354, e);
                }

                loader.load(url, function(font) {

                    // Add the file / rank labels
                    var opts = {
                        font: font,
                        size: 0.5,
                        height: 0.0,
                        weight: 'normal',
                        style: 'normal',
                        curveSegments: 12,
                        steps: 1,
                        bevelEnabled: false,
                        material: 0,
                        extrudeMaterial: 1
                    };

                    LABELS = [];
                    var textGeom;
                    var label;
                    var columnLabelText = "abcdefgh".split('');
                    for (var i = 0; i < 8; i++) {
                        textGeom = new THREE.TextGeometry(columnLabelText[i], opts);
                        textGeom.computeBoundingBox();
                        textGeom.computeVertexNormals();
                        label = new THREE.Mesh(textGeom, RANK_1_TEXT_MATERIAL);
                        label.position.x = 2 * i - 7 - opts.size/2;
                        label.position.y = -0.5;
                        label.position.z = -9;
                        LABELS.push(label);
                        SCENE.add(label);
                        label = new THREE.Mesh(textGeom, RANK_8_TEXT_MATERIAL);
                        label.position.x = 2 * i - 7 - opts.size/2;
                        label.position.y = -0.5;
                        label.position.z = 9;
                        LABELS.push(label);
                        SCENE.add(label);
                    }
                    var rankLabelText = "12345678".split('');
                    for (i = 0; i < 8; i++) {
                        textGeom = new THREE.TextGeometry(rankLabelText[i], opts);
                        label = new THREE.Mesh(textGeom, FILE_A_TEXT_MATERIAL);
                        label.position.x = -9;
                        label.position.y = -0.5;
                        label.position.z = -7 - opts.size / 2 + 2 * (7 - i);
                        LABELS.push(label);
                        SCENE.add(label);
                        label = new THREE.Mesh(textGeom, FILE_H_TEXT_MATERIAL);
                        label.position.x = 9;
                        label.position.y =  -0.5;
                        label.position.z = -7 - opts.size / 2 + 2 * (7 - i);
                        LABELS.push(label);
                        SCENE.add(label);
                    }
                });
            }

            function buildBoard() {
                var i;
                for (i = 0; i < 8; i++) {
                    var tz = 3.5 * SQUARE_SIZE - (SQUARE_SIZE * i);
                    for (var j = 0; j < 8; j++) {
                        var tx = (SQUARE_SIZE * j) - 3.5 * SQUARE_SIZE;
                        var square = 'abcdefgh'.charAt(j) + (i + 1);
                        var squareMaterial = (((i % 2) === 0) ^ ((j % 2) === 0) ? lightSquareMaterial : darkSquareMaterial);
                        var squareGeometry = new THREE.BoxGeometry(2, 0.5, 2);
                        var squareMesh = new THREE.Mesh(squareGeometry, squareMaterial.clone());
                        squareMesh.position.set(tx, -0.25, tz);
                        squareGeometry.computeFaceNormals();
                        squareGeometry.computeVertexNormals();
                        squareMesh.receiveShadow = true;
                        SQUARE_MESH_IDS[square] = squareMesh.id;
                        squareMesh.tag = square;
                        SCENE.add(squareMesh);
                    }
                }

                if (cfg.showNotation) {
                    addLabelsToScene();
                }

                for (var k = 0; k < LIGHT_POSITIONS.length; k++) {
                    var light = new THREE.SpotLight(0xAAAAAA);
                    var pos = LIGHT_POSITIONS[k];
                    light.position.set(pos[0], pos[1], pos[2]);
                    light.target = new THREE.Object3D();
                    if (k===0) {
                        light.castShadow = true;
                        light.shadow.bias = 0.0001;
                        light.shadow.mapSize.width = 2048;
                        light.shadow.mapSize.height = 2048;
                    }
                    SCENE.add(light);
                }
                var ambientLight = new THREE.AmbientLight(0x555555);
                SCENE.add(ambientLight);
            }

            // ---------------------------------------------------------------------//
            //                              ANIMATIONS                              //
            // ---------------------------------------------------------------------//

            // Verify that CURRENT_POSITION and PIECE_MESH_IDS are in sync
            function checkBoard() {
                for (var sq in PIECE_MESH_IDS) {
                    if (!PIECE_MESH_IDS.hasOwnProperty(sq) || validSpareSquare(sq)) {
                        continue;
                    }
                    if (CURRENT_POSITION.hasOwnProperty(sq) === false) {
                        error(3701, "Square "+sq+" in PIECE_MESH_IDS but not in CURRENT_POSITION");
                    } else {
                        if (!SCENE.getObjectById(PIECE_MESH_IDS[sq])) {
                            error(3702, "Mesh not present on square "+sq+", adding a replacement.");
                            var mesh = buildPieceMesh(sq, CURRENT_POSITION[sq]);
                            SCENE.add(mesh);
                            PIECE_MESH_IDS[sq] = mesh.id;
                        }
                    }
                }
                for (sq in CURRENT_POSITION) {
                    if (!CURRENT_POSITION.hasOwnProperty(sq)) {
                        continue;
                    }
                    if (PIECE_MESH_IDS.hasOwnProperty(sq) === false) {
                        error(3703, "Square "+sq+" in CURRENT_POSITION but not in PIECE_MESH_IDS");
                    }
                }
            }

            function animateSquareToSquare(src, dest, completeFn) {
                var destSquareMesh, pieceMesh;
                if (PIECE_MESH_IDS.hasOwnProperty(src)) {
                    pieceMesh = SCENE.getObjectById(PIECE_MESH_IDS[src]);
                }
                if (SQUARE_MESH_IDS.hasOwnProperty(dest)) {
                    destSquareMesh = SCENE.getObjectById(SQUARE_MESH_IDS[dest]);
                }
                if (validSpareSquare(src)) {
                    // this is an animation from a spare square to an ordinary square.
                    pieceMesh = pieceMesh.clone();
                    SCENE.add(pieceMesh);
                }
                if (destSquareMesh && pieceMesh) {
                    var tx_src = pieceMesh.position.x, tz_src = pieceMesh.position.z;
                    var tx_dest = destSquareMesh.position.x, tz_dest = destSquareMesh.position.z;
                    startTween(function(t) {
                        pieceMesh.position.x = tx_src + t * (tx_dest - tx_src);
                        pieceMesh.position.z = tz_src + t * (tz_dest - tz_src);
                    }, function() {
                        PIECE_MESH_IDS[dest] = pieceMesh.id;
                        if (validOrdinarySquare(src)) {
                            if (pieceMesh.id === PIECE_MESH_IDS[src]) {
                                delete PIECE_MESH_IDS[src];
                            }
                        }
                        completeFn();
                    }, cfg.moveSpeed);
                }
            }

            function animatePieceFadeOut(square, completeFn) {
                if (PIECE_MESH_IDS.hasOwnProperty(square)) {
                    if (validOrdinarySquare(square) && PIECE_MESH_IDS.hasOwnProperty(square)) {
                        var mesh = SCENE.getObjectById(PIECE_MESH_IDS[square]);
                        startTween(function(t) {
                            mesh.opacity = 1 - t;
                        }, function() {
                            SCENE.remove(mesh);
                            delete PIECE_MESH_IDS[square];
                            completeFn();
                        }, cfg.trashSpeed);
                    }
                }
            }

            function animatePieceFadeIn(square, piece, completeFn) {
                var mesh = buildPieceMesh(square, piece);
                mesh.opacity = 0;
                SCENE.add(mesh);
                startTween(function(t) {
                    mesh.opacity = t;
                }, function() {
                    PIECE_MESH_IDS[square] = mesh.id;
                    completeFn();
                }, cfg.appearSpeed);
            }

            function doAnimations(a, oldPos, newPos) {
                if (a.length === 0) {
                    return;
                }
                ANIMATION_HAPPENING = true;
                var numOps = a.length;

                function onFinish() {
                    numOps--;
                    if (numOps === 0) {
                        // the last callback to run
                        setCurrentPosition(newPos);
                         // run their onMoveEnd callback
                        if (cfg.hasOwnProperty('moveEnd') && typeof cfg.onMoveEnd === 'function') {
                            cfg.onMoveEnd(deepCopy(oldPos, deepCopy(newPos)));
                        }
                        RENDER_FLAG = true;
                        checkBoard();
                        ANIMATION_HAPPENING = false;
                    }
                }
                var j;
                for (j = 0; j < a.length; j++) {
                    if (a[j].type === 'clear') {
                        if (validOrdinarySquare(a[j].square) && PIECE_MESH_IDS.hasOwnProperty(a[j].square)) {
                            animatePieceFadeOut(a[j].square, onFinish);
                        }
                    }
                }
                for (j = 0; j < a.length; j++) {
                    if (a[j].type === 'move') {
                        animateSquareToSquare(a[j].source, a[j].destination, onFinish);
                    }
                }
                for (j = 0; j < a.length; j++) {
                    if (a[j].type === 'add') {
                        if (cfg.sparePieces === true) {
                            for (var sp in SPARE_POSITION) {
                                if (!SPARE_POSITION.hasOwnProperty(sp)) {
                                    continue;
                                }
                                if (SPARE_POSITION[sp] === a[j].piece) {
                                    animateSquareToSquare(sp, a[j].square, onFinish);
                                }
                            }
                        } else {
                            animatePieceFadeIn(a[j].square, a[j].piece, onFinish);
                        }
                    }
                }
            }

            function squareCoordinates(square) {
                var tx, tz;
                if (validSpareSquare(square)) {
                    var u = square.charCodeAt(2) - '1'.charCodeAt(0);
                    tx = SQUARE_SIZE * (4 * u - 10) / 3;
                    if (square.charAt(1) == 'w') {
                        tz = 5 * SQUARE_SIZE;

                    } else if (square.charAt(1) == 'b') {
                        tz = -5 * SQUARE_SIZE;
                    }
                } else if (validOrdinarySquare(square)) {
                    tx = SQUARE_SIZE * (square.charCodeAt(0) - 'a'.charCodeAt(0)) - 3.5 * SQUARE_SIZE;
                    tz = 3.5 * SQUARE_SIZE - SQUARE_SIZE * (square.charCodeAt(1) - '1'.charCodeAt(0));
                }
                return {
                    x : tx,
                    z : tz
                }
            }

            function pieceOnSquare(sq) {
                var position;
                if (validSpareSquare(sq)) {
                    position = SPARE_POSITION;
                } else if (validOrdinarySquare(sq)) {
                    position = CURRENT_POSITION;
                }
                if (!position) {
                    return;
                }
                return position[sq];
            }

            // returns the distance between two squares
            function squareDistance(s1, s2) {
                s1 = s1.split('');
                var s1x = COLUMNS.indexOf(s1[0]) + 1;
                var s1y = parseInt(s1[1], 10);

                s2 = s2.split('');
                var s2x = COLUMNS.indexOf(s2[0]) + 1;
                var s2y = parseInt(s2[1], 10);

                var xDelta = Math.abs(s1x - s2x);
                var yDelta = Math.abs(s1y - s2y);

                if (xDelta >= yDelta) return xDelta;
                return yDelta;
            }

            // returns an array of closest squares from square
            function createRadius(square) {
                var squares = [];
                var i, j;
                // calculate distance of all squares
                for (i = 0; i < 8; i++) {
                    for (j = 0; j < 8; j++) {
                        var s = COLUMNS[i] + (j + 1);

                        // skip the square we're starting from
                        if (square === s) continue;

                        squares.push({
                            square: s,
                            distance: squareDistance(square, s)
                        });
                    }
                }
                // sort by distance
                squares.sort(function(a, b) {
                    return a.distance - b.distance;
                });
                // just return the square code
                var squares2 = [];
                for (i = 0; i < squares.length; i++) {
                    squares2.push(squares[i].square);
                }
                return squares2;
            }

            // returns the square of the closest instance of piece
            // returns false if no instance of piece is found in position
            function findClosestPiece(position, piece, square) {
                // create array of closest squares from square
                var closestSquares = createRadius(square);
                // search through the position in order of distance for the piece
                for (var i = 0; i < closestSquares.length; i++) {
                    var s = closestSquares[i];
                    if (position.hasOwnProperty(s) === true && position[s] === piece) {
                        return s;
                    }
                }
                return false;
            }

            // calculate an array of animations that need to happen in order to get from pos1 to pos2
            function calculateAnimations(oldPosition, newPosition) {

                var pos1 = deepCopy(oldPosition);
                var pos2 = deepCopy(newPosition);

                var animations = [];
                var i;

                // remove pieces that are the same in both positions
                for (i in pos2) {
                    if (pos2.hasOwnProperty(i) !== true) continue;

                    if (pos1.hasOwnProperty(i) === true && pos1[i] === pos2[i]) {
                        delete pos1[i];
                        delete pos2[i];
                    }
                }

                // find all the "move" animations
                for (i in pos2) {
                    if (pos2.hasOwnProperty(i) !== true) continue;
                    var closestPiece = findClosestPiece(pos1, pos2[i], i);
                    if (closestPiece !== false) {
                        animations.push({
                            type: 'move',
                            source: closestPiece,
                            destination: i,
                            piece: pos2[i]
                        });
                        delete pos1[closestPiece];
                        delete pos2[i];
                    }
                }

                // add pieces to pos2
                for (i in pos2) {
                    if (pos2.hasOwnProperty(i) !== true) continue;

                    animations.push({
                        type: 'add',
                        square: i,
                        piece: pos2[i]
                    });

                    delete pos2[i];
                }

                // clear pieces from pos1
                for (i in pos1) {
                    if (pos1.hasOwnProperty(i) !== true) continue;
                    animations.push({
                        type: 'clear',
                        square: i,
                        piece: pos1[i]
                    });

                    delete pos1[i];
                }
                return animations;
            }

            function pickingRayCaster(mouseX, mouseY) {
                var vector = new THREE.Vector3((mouseX / RENDERER.domElement.width) * 2 - 1,
                    1 - (mouseY / RENDERER.domElement.height) * 2,
                    -0.5);
                vector.unproject(CAMERA);
                return new THREE.Raycaster(CAMERA.position,
                    vector.sub(CAMERA.position).normalize());
            }

            function projectOntoPlane(mouseX, mouseY, heightAboveBoard) {
                var planeY = new THREE.Plane(new THREE.Vector3(0, 1, 0), -heightAboveBoard);
                var raycaster = pickingRayCaster(mouseX, mouseY);
                var pos = raycaster.ray.intersectPlane(planeY);
                if (pos) {
                    return new THREE.Vector3(pos.x, heightAboveBoard, pos.z);
                }
                return null;
            }

            function isXZOnSquare(x_coord, z_coord) {
                for (var sq in SQUARE_MESH_IDS) {
                    if (SQUARE_MESH_IDS.hasOwnProperty(sq)) {
                        var squareMesh = SCENE.getObjectById(SQUARE_MESH_IDS[sq]);
                        if (x_coord >= squareMesh.position.x - SQUARE_SIZE / 2
                            && x_coord < squareMesh.position.x + SQUARE_SIZE / 2
                            && z_coord >= squareMesh.position.z - SQUARE_SIZE / 2
                            && z_coord < squareMesh.position.z + SQUARE_SIZE / 2) {
                            return sq;
                        }
                    }
                }

                if (cfg.sparePieces) {
                    // Return "spare square" code, e.g. sw1, sb2, sw3 etc.
                    var colorcode;
                    if (z_coord >= 4 * SQUARE_SIZE && z_coord <= 6 * SQUARE_SIZE) {
                        colorcode = 'w';
                    } else if (z_coord <= -4 * SQUARE_SIZE && z_coord >= -6 * SQUARE_SIZE) {
                        colorcode = 'b';
                    } else {
                        return 'offboard';
                    }
                    var u = Math.round(1 + ((10 - 3 * x_coord / SQUARE_SIZE) / 4));
                    if (u >= 1 && u <= 6) {
                        sq = 's' + colorcode + u;
                        return sq;
                    }
                }
                return 'offboard';
            }

            // Checks ray collisions with board or pieces
            function raycast(mouseX, mouseY) {

                var raycaster = pickingRayCaster(mouseX, mouseY);

                var possibleHits = {};
                var meshes = [];
                var count = 0;
                var intersection;
                var sq, piece, mesh;
                for (sq in PIECE_MESH_IDS) {
                    if (!PIECE_MESH_IDS.hasOwnProperty(sq)) {
                        continue;
                    }
                    piece = PIECE_MESH_IDS[sq];
                    if (!piece) {
                        continue;
                    }
                    var pieceMesh = SCENE.getObjectById(PIECE_MESH_IDS[sq]);
                    piece = pieceOnSquare(sq);
                    var pieceBoundingBox = GEOMETRIES[piece.charAt(1)].boundingBox.clone();
                    pieceBoundingBox.min.x += pieceMesh.position.x;
                    pieceBoundingBox.max.x += pieceMesh.position.x;
                    pieceBoundingBox.min.z += pieceMesh.position.z;
                    pieceBoundingBox.max.z += pieceMesh.position.z;

                    intersection = raycaster.ray.intersectBox(pieceBoundingBox);

                    if (intersection) {
                        possibleHits[sq] = intersection;
                        meshes.push(pieceMesh);
                        count++;
                    }
                }
                if (meshes.length > 0) {
                    if (meshes.length === 1) {
                        // we hit one piece's bounding box; just take a shortcut and assume an exact hit:
                        sq = Object.keys(possibleHits)[0];
                        intersection = possibleHits[sq];
                        mesh = meshes[0];
                        return {
                            source : sq,
                            location : sq,
                            piece : pieceOnSquare(sq),
                            mesh : mesh,
                            intersection_point : intersection,
                            off_center_x : intersection.x - mesh.position.x,
                            off_center_z : intersection.z - mesh.position.z
                        };
                    }
                    // Check piece meshes to see which mesh is closest to camera
                    // The intersectObjects() call is more expensive than the call to intersectBox()
                    var intersects = raycaster.intersectObjects(meshes);
                    if (intersects.length > 0) {
                        for (sq in possibleHits) {
                            if (possibleHits.hasOwnProperty(sq)) {
                                mesh = SCENE.getObjectById(PIECE_MESH_IDS[sq]);
                                if (mesh === intersects[0].object) {
                                    intersection = intersects[0].point;
                                    return {
                                        source : sq,
                                        location : sq,
                                        piece : pieceOnSquare(sq),
                                        mesh : mesh,
                                        intersection_point : intersection,
                                        off_center_x : intersection.x - mesh.position.x,
                                        off_center_z : intersection.z - mesh.position.z
                                    };
                                }
                            }
                        }
                    }
                }

                // We didn't hit an actual piece mesh. Did we hit anything, like a square, empty or not?
                var pos = projectOntoPlane(mouseX, mouseY, 0);
                if (!pos) {
                    return {
                        source : 'offboard',
                        location: 'offboard'
                    }
                }
                sq = isXZOnSquare(pos.x, pos.z);
                piece = pieceOnSquare(sq);
                mesh = SCENE.getObjectById(PIECE_MESH_IDS[sq]);
                return {
                    source : sq,
                    location : sq,
                    piece : piece,
                    mesh : mesh,
                    intersection_point : new THREE.Vector3(pos.x, 0, pos.z),
                    off_center_x : (mesh ? pos.x - mesh.position.x : undefined),
                    off_center_z : (mesh ? pos.z - mesh.position.z : undefined)
                }
            }

            function updateLocation(raycast, mouse_x, mouse_y) {
                var pos = projectOntoPlane(mouse_x, mouse_y, raycast.intersection_point.y);
                if (!pos) {
                    return; // ray parallel to xz plane
                }
                pos.x -= raycast.off_center_x;
                pos.z -= raycast.off_center_z;
                raycast.location = isXZOnSquare(pos.x, pos.z);
                if (raycast.mesh.position.x !== pos.x || raycast.mesh.position.z !== pos.z) {
                    raycast.mesh.position.x = pos.x;
                    raycast.mesh.position.z = pos.z;
                }
            }

            function drawSparePieces() {
                for (var sq in SPARE_POSITION) {
                    if (!SPARE_POSITION.hasOwnProperty(sq)) {
                        continue;
                    }
                    var piece = SPARE_POSITION[sq];
                    var mesh = buildPieceMesh(sq, piece);
                    mesh.position.y = -0.5; // board thickness
                    PIECE_MESH_IDS[sq] = mesh.id;
                    SCENE.add(mesh);
                }
            }

            function snapbackDraggedPiece() {
                removeSquareHighlights();
                if (validSpareSquare(DRAG_INFO.source)) {
                    SCENE.remove(DRAG_INFO.mesh);
                    DRAG_INFO = null;
                } else {
                    var tx_start = DRAG_INFO.mesh.position.x;
                    var tz_start = DRAG_INFO.mesh.position.z;
                    var squareMesh = SCENE.getObjectById(SQUARE_MESH_IDS[DRAG_INFO.source]);
                    var tx_target = squareMesh.position.x;
                    var tz_target = squareMesh.position.z;
                    var end = function() {
                        DRAG_INFO.mesh.position.x = tx_target;
                        DRAG_INFO.mesh.position.z = tz_target;
                        var piece = DRAG_INFO.piece, source = DRAG_INFO.source;
                        DRAG_INFO = null;
                        if (cfg.hasOwnProperty('onSnapbackEnd') && typeof cfg.onSnapbackEnd === 'function') {
                            cfg.onSnapbackEnd(piece, source, deepCopy(CURRENT_POSITION), CURRENT_ORIENTATION);
                        }
                        ANIMATION_HAPPENING = false;
                        RENDER_FLAG = true;
                    };
                    startTween(function(t) {
                        DRAG_INFO.mesh.position.x = tx_start + t * (tx_target - tx_start);
                        DRAG_INFO.mesh.position.z = tz_start + t * (tz_target - tz_start);
                    }, end, 100);
                }
            }

            function trashDraggedPiece() {
                removeSquareHighlights();
                SCENE.remove(DRAG_INFO.mesh);
                if (validOrdinarySquare(DRAG_INFO.source)) {
                    var position = deepCopy(CURRENT_POSITION);
                    delete position[DRAG_INFO.source];
                    setCurrentPosition(position);
                    delete PIECE_MESH_IDS[DRAG_INFO.source];
                }
                DRAG_INFO = null;
            }

            function dropDraggedPieceOnSquare() {
                removeSquareHighlights();
                var newPosition = deepCopy(CURRENT_POSITION);
                var squareMesh = SCENE.getObjectById(SQUARE_MESH_IDS[DRAG_INFO.location]);
                DRAG_INFO.mesh.position.x = squareMesh.position.x;
                DRAG_INFO.mesh.position.z = squareMesh.position.z;
                if (validOrdinarySquare(DRAG_INFO.source)) {
                    delete newPosition[DRAG_INFO.source];
                    delete PIECE_MESH_IDS[DRAG_INFO.source];
                }
                if (newPosition[DRAG_INFO.location]) {
                    SCENE.remove(SCENE.getObjectById(PIECE_MESH_IDS[DRAG_INFO.location]));
                }
                newPosition[DRAG_INFO.location] = DRAG_INFO.piece;
                PIECE_MESH_IDS[DRAG_INFO.location] = DRAG_INFO.mesh.id;
                var src = DRAG_INFO.source, tgt = DRAG_INFO.location, piece = DRAG_INFO.piece;
                DRAG_INFO = null;
                setCurrentPosition(newPosition);
                if (cfg.hasOwnProperty('onSnapEnd') && typeof cfg.onSnapEnd === 'function') {
                    cfg.onSnapEnd(src, tgt, piece);
                }
            }

            // ---------------------------------------------------------------------//
            //                             CONTROL FLOW                             //
            // ---------------------------------------------------------------------//

            function drawPositionInstant() {
                for (var sq in PIECE_MESH_IDS) {
                    if (PIECE_MESH_IDS.hasOwnProperty(sq) !== true) {
                        continue;
                    }
                    if (validSpareSquare(sq)) {
                        continue; // leave spare pieces
                    }
                    SCENE.remove(SCENE.getObjectById(PIECE_MESH_IDS[sq]));
                    delete PIECE_MESH_IDS[sq];
                }
                // add new meshes
                for (var square in CURRENT_POSITION) {
                    if (CURRENT_POSITION.hasOwnProperty(square) !== true) {
                        continue;
                    }
                    var mesh = buildPieceMesh(square, CURRENT_POSITION[square]);
                    PIECE_MESH_IDS[square] = mesh.id;
                    SCENE.add(mesh);
                }
            }

            function drawBoard() {
                if (cfg.sparePieces) {
                    drawSparePieces();
                }
                drawPositionInstant();
            }

            // given a position and a set of moves, return a new position with the moves executed
            function calculatePositionFromMoves(position, moves) {
                position = deepCopy(position);
                for (var i in moves) {
                    if (moves.hasOwnProperty(i) !== true) continue;

                    // skip the move if the position doesn't have a piece on the source square
                    if (position.hasOwnProperty(i) !== true) continue;

                    var piece = position[i];
                    delete position[i];
                    position[moves[i]] = piece;
                }
                return position;
            }

            function setCurrentPosition(position) {
                var oldPos = deepCopy(CURRENT_POSITION);
                var newPos = deepCopy(position);
                var oldFen = objToFen(oldPos);
                var newFen = objToFen(newPos);
                if (oldFen === newFen) {
                    return;
                }
                if (cfg.hasOwnProperty('onChange') && typeof cfg.onChange === 'function') {
                    cfg.onChange(oldPos, newPos);
                }
                CURRENT_POSITION = position;
            }

            function addSquareHighlight(sq, color) {
                if (!color) {
                    color = 0xFFFF00;
                }
                var squareMesh = SCENE.getObjectById(SQUARE_MESH_IDS[sq]);
                var highlightMesh = null;
                if (squareMesh) {
                    var highlight_geometry = new THREE.TorusGeometry(1.2 * SQUARE_SIZE / 2, 0.1, 4, 4);
                    highlightMesh = new THREE.Mesh(highlight_geometry, new THREE.MeshBasicMaterial({color: new THREE.Color(color)}));
                    highlightMesh.position.x = squareMesh.position.x;
                    highlightMesh.position.y = 0;
                    highlightMesh.position.z = squareMesh.position.z;
                    highlightMesh.rotation.z = Math.PI / 4;
                    highlightMesh.rotation.x = Math.PI / 2;
                    SCENE.add(highlightMesh);
                }
                return highlightMesh;
            }

            function removeSourceHighlight() {
                if (SOURCE_SQUARE_HIGHLIGHT_MESH) {
                    SCENE.remove(SOURCE_SQUARE_HIGHLIGHT_MESH);
                    SOURCE_SQUARE_HIGHLIGHT_MESH = null;
                }
            }

            function removeDestinationHighlight() {
                if (DESTINATION_SQUARE_HIGHLIGHT_MESH) {
                    SCENE.remove(DESTINATION_SQUARE_HIGHLIGHT_MESH);
                    DESTINATION_SQUARE_HIGHLIGHT_MESH = null;
                }
            }

            function removeSquareHighlights() {
                removeSourceHighlight();
                removeDestinationHighlight();
                widget.removeGreySquares();
            }

            function highlightSourceSquare(sq) {
                removeSourceHighlight();
                SOURCE_SQUARE_HIGHLIGHT_MESH = addSquareHighlight(sq);
            }

            function highlightDestinationSquare(sq) {
                removeDestinationHighlight();
                DESTINATION_SQUARE_HIGHLIGHT_MESH = addSquareHighlight(sq);
            }

            function beginDraggingPiece() {
                if (CAMERA_CONTROLS) {
                    CAMERA_CONTROLS.enabled = false;
                }
                if (cfg.hasOwnProperty('onDragStart') && typeof cfg.onDragStart === 'function' &&
                    cfg.onDragStart(DRAG_INFO.source,
                        DRAG_INFO.piece,
                        deepCopy(CURRENT_POSITION),
                        CURRENT_ORIENTATION) === false) {
                    DRAG_INFO = null;
                    return;
                }
                if (validSpareSquare(DRAG_INFO.source)) {
                    // dragging a spare piece
                    DRAG_INFO.mesh = DRAG_INFO.mesh.clone();
                    DRAG_INFO.mesh.position.y = 0; // lift spare piece onto the board
                    SCENE.add(DRAG_INFO.mesh);
                    RENDER_FLAG = true;
                } else if (validOrdinarySquare(DRAG_INFO.source)) {
                    // dragging an ordinary piece
                    highlightSourceSquare(DRAG_INFO.source);
                }
            }

            function updateDraggedPiece(mouse_x, mouse_y) {
                var priorLocation = DRAG_INFO.location;
                updateLocation(DRAG_INFO, mouse_x, mouse_y);
                //DRAG_INFO.updateLocation(mouse_x, mouse_y);
                if (priorLocation !== DRAG_INFO.location) {
                    removeDestinationHighlight();
                    if (validOrdinarySquare(DRAG_INFO.location) && DRAG_INFO.location !== DRAG_INFO.source) {
                        highlightDestinationSquare(DRAG_INFO.location);
                    }
                }
                if (cfg.hasOwnProperty('onDragMove') && typeof cfg.onDragMove === 'function') {
                    cfg.onDragMove(DRAG_INFO.location, priorLocation, DRAG_INFO.source, DRAG_INFO.piece,
                        deepCopy(CURRENT_POSITION), CURRENT_ORIENTATION);
                }
            }

            function stopDraggedPiece() {
                var action = 'drop';
                if (DRAG_INFO.location === 'offboard'
                    || validSpareSquare(DRAG_INFO.location)) {
                    if (cfg.dropOffBoard === 'snapback') {
                        action = 'snapback';
                    }
                    if (cfg.dropOffBoard === 'trash') {
                        action = 'trash';
                    }
                }

                // Call onDrop on event handlers, possibly changing action
                if (cfg.hasOwnProperty('onDrop') && typeof cfg.onDrop === 'function') {
                    var newPosition = deepCopy(CURRENT_POSITION);

                    // source piece is a spare piece and destination is on the board
                    if (validSpareSquare(DRAG_INFO.source) && validOrdinarySquare(DRAG_INFO.location)) {
                        newPosition[DRAG_INFO.location] = DRAG_INFO.piece;
                    }
                    // source piece was on the board and destination is off the board
                    if (validOrdinarySquare(DRAG_INFO.source) && !validOrdinarySquare(DRAG_INFO.location)) {
                        delete newPosition[DRAG_INFO.source];
                    }
                    // Both source piece and destination are on the board
                    if (validOrdinarySquare(DRAG_INFO.source) && validOrdinarySquare(DRAG_INFO.location)) {
                        delete newPosition[DRAG_INFO.source];
                        newPosition[DRAG_INFO.location] = DRAG_INFO.piece;
                    }
                    var oldPosition = deepCopy(CURRENT_POSITION);
                    var result = cfg.onDrop(DRAG_INFO.source, DRAG_INFO.location, DRAG_INFO.piece, newPosition, oldPosition, CURRENT_ORIENTATION);
                    if (result === 'snapback' || result === 'trash') {
                        action = result;
                    }
                }

                if (action === 'snapback') {
                    snapbackDraggedPiece();
                }
                else if (action === 'trash') {
                    trashDraggedPiece();
                }
                else if (action === 'drop') {
                    dropDraggedPieceOnSquare();
                }
                if (CAMERA_CONTROLS) {
                    CAMERA_CONTROLS.enabled = true;
                }
                RENDER_FLAG = true;
                removeSquareHighlights();
            }

            // ---------------------------------------------------------------------//
            //                            PUBLIC METHODS                            //
            // ---------------------------------------------------------------------//

            // clear the board
            widget.clear = function(useAnimation) {
                widget.position({}, useAnimation);
            };

            // remove the widget from the page
            widget.destroy = function() {
                // remove markup
                RENDERER.domElement.removeEventListener('mousedown', mouseDown);
                RENDERER.domElement.removeEventListener('mousemove', mouseMove);
                RENDERER.domElement.removeEventListener('mouseup', mouseUp);
                containerEl.removeChild(RENDERER.domElement);
            };

            // Return FEN string of current position
            widget.fen = function() {
                return widget.position('fen');
            };

            // flip orientation
            widget.flip = function() {
                return widget.orientation('flip');
            };

            // highlight a square from client code
            widget.greySquare = function(sq) {
                USER_HIGHLIGHT_MESHES.push(addSquareHighlight(sq, 0x404040));
                RENDER_FLAG = true;
            };

            // clear all highlights set from client code
            widget.removeGreySquares = function() {
                while (USER_HIGHLIGHT_MESHES.length > 0) {
                    SCENE.remove(USER_HIGHLIGHT_MESHES.pop());
                }
                USER_HIGHLIGHT_MESHES = [];
                RENDER_FLAG = true;
            };

            // move pieces
            widget.move = function() {
                // no need to throw an error here; just do nothing
                if (arguments.length === 0) return;
                var useAnimation = true;
                // collect the moves into an object
                var moves = {};
                for (var i = 0; i < arguments.length; i++) {
                    // any "false" to this function means no animations
                    if (arguments[i] === false) {
                        useAnimation = false;
                        continue;
                    }
                    // skip invalid arguments
                    if (validMove(arguments[i]) !== true) {
                        error(2826, 'Invalid move passed to the move method.', arguments[i]);
                        continue;
                    }
                    var tmp = arguments[i].split('-');
                    moves[tmp[0]] = tmp[1];
                }

                // calculate position from moves
                var newPos = calculatePositionFromMoves(CURRENT_POSITION, moves);

                // update the board
                widget.position(newPos, useAnimation);

                // return the new position object
                return newPos;
            };

            widget.orientation = function(arg) {
                // no arguments, return the current orientation
                if (arguments.length === 0) {
                    return CURRENT_ORIENTATION;
                }
                // set to white or black
                if (arg === 'white' || arg === 'black') {
                    CURRENT_ORIENTATION = arg;
                    if (arg === 'white') {
                        swivelCamera(CAMERA_POSITION_WHITE);
                    } else {
                        swivelCamera(CAMERA_POSITION_BLACK);
                    }
                    return CURRENT_ORIENTATION;
                }
                // flip orientation
                if (arg === 'flip') {
                    CURRENT_ORIENTATION = (CURRENT_ORIENTATION === 'white') ? 'black' : 'white';
                    if (CURRENT_ORIENTATION === 'white') {
                        swivelCamera(CAMERA_POSITION_WHITE);
                    } else {
                        swivelCamera(CAMERA_POSITION_BLACK);
                    }
                    return CURRENT_ORIENTATION;
                }
                error(5482, 'Invalid value passed to the orientation method.', arg);
            };

            widget.flip = function() {
                widget.orientation('flip');
            };

            widget.position = function(position, useAnimation) {
                // no arguments, return the current position
                if (arguments.length === 0) {
                    return deepCopy(CURRENT_POSITION);
                }

                // get position as FEN
                if (typeof position === 'string' && position.toLowerCase() === 'fen') {
                    return objToFen(CURRENT_POSITION);
                }

                // default for useAnimations is true
                if (useAnimation !== false) {
                    useAnimation = true;
                }

                // start position
                if (typeof position === 'string' && position.toLowerCase() === 'start') {
                    position = deepCopy(START_POSITION);
                }

                // convert FEN to position object
                if (validFen(position) === true) {
                    position = fenToObj(position);
                }

                // validate position object
                if (validPositionObject(position) !== true) {
                    error(6482, 'Invalid value passed to the position method.', position);
                    return;
                }

                var doDrawing = function() {
                    if (useAnimation) {
                        var anims = calculateAnimations(CURRENT_POSITION, position);
                        doAnimations(anims, CURRENT_POSITION, position); // invokes setCurrentPosition() from a callback
                    } else {
                        // instant update
                        setCurrentPosition(position);
                        drawPositionInstant();
                        RENDER_FLAG = true;
                    }
                };

                if (checkGeometriesLoaded() && ANIMATION_HAPPENING === false) {
                    doDrawing(); // normal case
                } else {
                    // Someone called position() before the geometries finished loading,
                    // or animations are still going
                    var keepWaiting = function() {
                        if (checkGeometriesLoaded() === false || ANIMATION_HAPPENING) {
                            setTimeout(keepWaiting, 100);
                        } else {
                            doDrawing();
                        }
                    };
                    keepWaiting();
                }
            };

            widget.resize = function() {
                var w = containerEl.clientWidth;
                if (CAMERA) {
                    CAMERA.updateProjectionMatrix();
                }
                if (RENDERER) {
                    RENDERER.setSize(w, w * ASPECT_RATIO);
                }
                RENDER_FLAG = true;
            };

            widget.rerender = function() {
                RENDER_FLAG = true;
            };

            widget.start = function(useAnimation) {
                widget.position('start', useAnimation);
            };

            // ---------------------------------------------------------------------//
            //                            BROWSER EVENTS                            //
            // ---------------------------------------------------------------------//

            function offset(e, useTouchObject) {
                var target = e.target || e.srcElement,
                    rect = target.getBoundingClientRect();
                var offsetX, offsetY;
                if (useTouchObject && e.touches.length > 0) {
                    offsetX = e.touches[0].clientX - rect.left;
                    offsetY = e.touches[0].clientY - rect.top;
                } else {
                    offsetX = e.clientX - rect.left,
                    offsetY = e.clientY - rect.top;
                }
                return {
                    x: offsetX,
                    y: offsetY
                };
            }

            function mouseDown(e, useTouchObject) {
                e.preventDefault();
                if (DRAG_INFO) {
                    return;
                }
                if (!cfg.draggable) {
                    return;
                }
                var coords = offset(e, useTouchObject);
                var dragged = raycast(coords.x, coords.y);
                if (dragged && dragged.piece !== undefined) {
                    DRAG_INFO = dragged;
                    MOUSEOVER_SQUARE = 'offboard';
                    beginDraggingPiece();
                } else {
                    if (CAMERA_CONTROLS) {
                        CAMERA_CONTROLS.enabled = true;
                    }
                }
            }

            function mouseMove(e, useTouchObject) {
                e.preventDefault();
                var coords = offset(e, useTouchObject);
                if (DRAG_INFO) {
                    updateDraggedPiece(coords.x, coords.y);
                } else {
                    // Support onMouseOutSquare() and mouseOverSquare() callbacks if they exist
                    var callOut, callOver;
                    if (cfg.hasOwnProperty('onMouseoutSquare') && typeof (cfg.onMouseoutSquare) === 'function') {
                        callOut = cfg.onMouseoutSquare;
                    }
                    if (cfg.hasOwnProperty('onMouseoverSquare') && typeof (cfg.onMouseoverSquare) === 'function') {
                        callOver = cfg.onMouseoverSquare;
                    }
                    if (callOut || callOver) {
                        var rc = raycast(coords.x, coords.y).source;
                        var currentPosition = deepCopy(CURRENT_POSITION);
                        if (rc && rc.source && rc.source !== MOUSEOVER_SQUARE) {
                            var currentSquare = rc.source;
                            var piece;
                            if (callOut && validOrdinarySquare(MOUSEOVER_SQUARE)) {
                                piece = false;
                                if (currentPosition.hasOwnProperty(MOUSEOVER_SQUARE)) {
                                    piece = currentPosition[MOUSEOVER_SQUARE];
                                }
                                callOut(MOUSEOVER_SQUARE, piece, currentPosition, CURRENT_ORIENTATION);
                            }
                            if (callOver && validOrdinarySquare(currentSquare)) {
                                piece = false;
                                if (currentPosition.hasOwnProperty(currentSquare)) {
                                    piece = currentPosition[currentSquare];
                                }
                                callOver(currentSquare, piece, currentPosition, CURRENT_ORIENTATION);
                            }
                            MOUSEOVER_SQUARE = currentSquare;
                        }
                    }
                }
            }

            function mouseUp(e) {
                e.preventDefault();
                if (DRAG_INFO) {
                    stopDraggedPiece();
                }
            }

            // ---------------------------------------------------------------------//
            //                            INITIALIZATION                            //
            // ---------------------------------------------------------------------//

            function loadGeometry(name) {
                var url;
                if (typeof cfg.pieceSet === 'function') {
                    url = cfg.pieceSet(name);
                } else if (typeof cfg.pieceSet === 'string') {
                    var pieceSet = cfg.pieceSet;
                    url = pieceSet.replace("{piece}", name);
                }
                var loader = new THREE.JSONLoader();
                if (cfg.hasOwnProperty('localStorage') && cfg.localStorage === false) {
                    window.localStorage.removeItem(url);
                }
                var json = window.localStorage.getItem(url);
                if (json) {
                    var loadedGeometry = JSON.parse(json);
                    var result = loader.parse(loadedGeometry.data);
                    GEOMETRIES[name] = result.geometry;
                    GEOMETRIES[name].computeBoundingBox();
                } else {
                    loader.load(url, function (geometry) {
                        GEOMETRIES[name] = geometry;
                        geometry.computeBoundingBox();
                        if (cfg.hasOwnProperty('localStorage') === false || cfg.localStorage !== false) {
                            window.localStorage.setItem(url, JSON.stringify(geometry.toJSON()));
                        }
                    });
                }
            }

            function checkGeometriesLoaded() {
                return GEOMETRIES.P !== undefined
                    && GEOMETRIES.N !== undefined
                    && GEOMETRIES.B !== undefined
                    && GEOMETRIES.R !== undefined
                    && GEOMETRIES.Q !== undefined
                    && GEOMETRIES.K !== undefined;
            }

            function init() {
                if (checkDeps() !== true ||
                    expandConfig() !== true) {
                    return;
                }
                widget.resize();
                prepareScene();
                buildBoard();
                loadGeometry('K');
                loadGeometry('Q');
                loadGeometry('R');
                loadGeometry('B');
                loadGeometry('N');
                loadGeometry('P');

                function checkInitialization() {
                    if (checkGeometriesLoaded()) {
                        drawBoard();
                        animate();
                    } else {
                        setTimeout(checkInitialization, 20);
                    }
                }
                checkInitialization();

                function animate() {
                    requestAnimationFrame(animate);
                    updateAllTweens();
                    var cameraPosition = CAMERA.position.clone();
                    if (CAMERA_CONTROLS && CAMERA_CONTROLS.enabled) {
                        CAMERA_CONTROLS.update();
                    }
                    var cameraMoved = (CAMERA.position.x !== cameraPosition.x
                    || CAMERA.position.y !== cameraPosition.y
                    || CAMERA.position.z !== cameraPosition.z);

                    if (RENDER_FLAG || cameraMoved) {
                        var x = CAMERA.position.x, y = CAMERA.position.y, z = CAMERA.position.z;
                        for (var i in LABELS) {
                            if (!LABELS.hasOwnProperty(i)) {
                                continue;
                            }
                            LABELS[i].lookAt(new THREE.Vector3(100 * x, 100 * y, 100 * z));
                        }
                        if (x <= -8) {
                            FILE_A_TEXT_MATERIAL.opacity = 1;
                            FILE_H_TEXT_MATERIAL.opacity = 0;
                        } else if (x >= 8) {
                            FILE_A_TEXT_MATERIAL.opacity = 0;
                            FILE_H_TEXT_MATERIAL.opacity = 1;
                        } else {
                            FILE_A_TEXT_MATERIAL.opacity = FILE_H_TEXT_MATERIAL.opacity = 1;
                        }
                        if (z <= -8) {
                            RANK_1_TEXT_MATERIAL.opacity = 1;
                            RANK_8_TEXT_MATERIAL.opacity = 0;
                        } else if (z >= 8) {
                            RANK_1_TEXT_MATERIAL.opacity = 0;
                            RANK_8_TEXT_MATERIAL.opacity = 1;
                        } else {
                            RANK_1_TEXT_MATERIAL.opacity = RANK_8_TEXT_MATERIAL.opacity = 1;
                        }
                    }
                    if (RENDER_FLAG || DRAG_INFO !== null || ANIMATION_HAPPENING || cameraMoved) {
                        var goahead = true;
                        if (cfg.hasOwnProperty('onRender') && typeof cfg.onRender === 'function') {
                            if (cfg.onRender(SCENE, deepCopy(SQUARE_MESH_IDS), deepCopy(PIECE_MESH_IDS), deepCopy(CURRENT_POSITION)) === false) {
                                goahead = false;
                            }
                        }
                        if (goahead) {
                            if (!addedToContainer) {
                                while (containerEl.firstChild) {
                                    containerEl.removeChild(containerEl.firstChild);
                                }
                                containerEl.appendChild(RENDERER.domElement);
                                addedToContainer = true;
                            }
                            RENDERER.render(SCENE, CAMERA);
                            RENDER_FLAG = false;
                        } else {
                            RENDER_FLAG = true;
                        }
                    }
                }
            }
            init();
            return widget;
        };

    // expose util functions
    window.ChessBoard3.webGLEnabled = webGLEnabled;
    window.ChessBoard3.fenToObj = fenToObj;
    window.ChessBoard3.objToFen = objToFen;
})();