# chessboard3.js - A 3D JavaScript Chess Board

**chessboard3.js** is a standalone JavaScript chess board based on WebGL that mirrors the API of the widely used __[chessboard.js](www.chessboardjs.com)__ 2D board library by [Chris Oakman](https://github.com/oakmac/chessboardjs). It is designed to be a drop-in replacement for chessboard.js and should run with any existing client code that currently uses chessboard.js to display a 2D board.

Like its 2D analogue, chessboard3.js is a "dumb board" with no AI or move validation. The flexible API that has made chessboard.js useful in a variety of applications is fully available, and if necessary chessboard.js can be used as a fallback for hessboard3.js in case WebGL is not available.

Since it uses WebGL and [three.js](www.threejs.org) to render the board (as opposed to DOM manipulation with JQuery), chessboard3.js is naturally going to be more resource-intensive.
You can do the same things you can with Chris Oakman's chessboard.js (given the caveats that come with using WebGL).

## Extra equipment you may need

Neither chessboard3.js nor chessboard.js actually knows how to play chess! You need separate components for the following:

+ PGN parsing
+ Move validation
+ A chess engine (you can use a Javascript chess engine like [cinnamon](http://cinnamonchess.altervista.org/))

## Dependencies

The set of extra libraries used by chessboard3.js differs from those used by chessboard.js:

- [**three.js**](threejs.org) : Tested against revision [80](https://github.com/mrdoob/three.js/releases/tag/r80).
- [**OrbitControls.js**](https://github.com/mrdoob/three.js/tree/master/examples/js/controls)) : Optional, this is a three.js extension that allows the user to grab the board and either spin it around or zoom into it.

The font and piece geometry files from assets directory; these are accessed via JSON

**I have code that uses chessboard.js for a 2D board. What code changes are needed for a 3D board?**

You would replace this:

```
var board = new ChessBoard('divElementID', configObject);
```

with this:

```
var board = new ChessBoard3('divElementID', configObject);
```

You will also want to place it in a wider DIV, since a 3D board generally needs more real estate. While chessboard.js sets the widget height to be equal to the width to make a square widget, chessboard3.js sets the height to 75% of the width for a 4:3 aspect ratio.


# API

An overview, documentation, and a playable demo can be found at <http://chessboard3js.com>.

Since chessboard3.js exposes a slight superset of the chessboard.js API, another good reference is <http://chessboardjs.com/docs>.


# License

chessboard3.js is released under the [MIT License](https://github.com/jtiscione/chessboard3js/blob/master/LICENSE).
