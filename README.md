#chessboard3.js - A 3D JavaScript Chess Board#

**chessboard3.js** is a standalone JavaScript chess board based on WebGL that mirrors the API of the widely used __[chessboard.js](www.chessboardjs.com)__ 2D board library by [Chris Oakman](https://github.com/oakmac/chessboardjs). It is designed to be a drop-in replacement for chessboard.js and should run with any existing client code that currently uses chessboard.js to display a 2D board.

Like its 2D analogue, chessboard3.js is a "dumb board" with no AI or move validation. The flexible API that has made chessboard.js useful in a variety of applications is fully available, and if necessary chessboard.js can be used as a fallback for hessboard3.js in case WebGL is not available.

Since it uses WebGL and [three.js](www.threejs.org) to render the board (as opposed to DOM manipulation with JQuery), chessboard3.js is naturally going to be more resource-intensive. In general I wouldn't recommend placing multiple WebGL boards on a given page (or WebGL anything).

##Things you can do with chessboard3.js:##
- Use chessboard3.js to illustrate positions.
- Use chessboard3.js to have users attempt chess puzzles.
- Allow users to set up new positions via drag and drop
- Integrate chessboard3.js and [chess.js](https://github.com/jhlywa/chess.js) with a PGN database of famous games.
- Have users play against a chess engine using chessboard3.js as the UI.

You can do the same things you can with Chris Oakman's chessboard.js (given the caveats that come with using WebGL).

##Extra equipment you may need##

Neither chessboard3.js nor chessboard.js actually knows how to play chess! You need separate components for the following:

+ PGN parsing - The UI uses algebraic notation and is clueless about PGN.
+ Move validation - The board doesn't know the rules of chess. But it can be used with [chess.js](https://github.com/jhlywa/chess.js) by Jeff Hlywa, as mentioned above.
+ A chess engine (you can use a Javascript chess engine like [cinnamon](http://cinnamonchess.altervista.org/), or use node.js and the [UCI node module](https://www.npmjs.com/package/uci) to dispatch to a real chess engine running on a server.

##Dependencies##

The set of extra libraries used by chessboard3.js differs from those used by chessboard.js:

- [**three.js**](threejs.org) : Required; chessboard3.js will fall flat on its face without it. Versions of three.js prior to revision 71 will not work- the library will refuse to run- since some older versions handle raycasting differently and have problems detecting object collisions with the mouse pointer. I haven't yet determined the earliest three.js version that doesn't introduce these problems, so for now revision 71 is required.
- [**tween.js**](http://www.createjs.com/tweenjs) : Optional, used for animations. If not supplied, chessboard3.js will complain it can't do animations for moving pieces and swivelling the board around; but it will still run. 
- [**OrbitControls.js**](https://github.com/mrdoob/three.js/tree/master/examples/js/controls)) : Optional, this is a three.js extension that allows the user to grab the board and either spin it around or zoom into it. This library is optional.
- [**helvetiker_regular_typeface.js**](https://github.com/mrdoob/three.js/tree/master/examples/fonts): Optional, this is one of the toy fonts that comes with three.js. It needs to be present for the `showNotation` option to work (which labels the files and ranks, and defaults to true). If `showNotation` is set to false, this font library won't be needed at all.

##I have code that uses chessboard.js for a 2D board. What code changes are needed for a 3D board?##

You would replace this:

```
var board = new ChessBoard('divElementID', configObject);
```

with this:

```
var board = new ChessBoard3('divElementID', configObject);
```

You will also want to place it in a wider DIV, since a 3D board generally needs more real estate. While chessboard.js sets the widget height to be equal to the width to make a square widget, chessboard3.js sets the height to 75% of the width for a 4:3 aspect ratio.


#API#

An overview, documentation, and a playable demo can be found at <http://chessboard3js.com>.

Since chessboard3.js exposes a slight superset of the chessboard.js API, another good reference is <http://chessboardjs.com/docs>.


#License#
--------------------------------------

chessboard3.js is released under the [MIT License](https://github.com/jtiscione/chessboard3js/blob/master/LICENSE).