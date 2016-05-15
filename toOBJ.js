const fs = require( 'fs' );
const outFile = process.argv[ 2 ] || 'out';
const objStream = fs.createWriteStream( outFile + '.obj' );
const mtlStream = fs.createWriteStream( outFile + '.mtl' );
const md5 = require( 'blueimp-md5' );

var haveMaterials = {}; // Will hold materials that we have already derived

function init( ) {
  objStream.write( 'mtllib ' + outFile + '.mtl\n' );
}

function getVertex( buffer ) {
  var coOrds = {};

  coOrds.x = ( buffer.readUInt16LE( 1 ) << 8 | buffer.readUInt8( 0 ) );
  coOrds.y = ( buffer.readUInt16LE( 4 ) << 8 | buffer.readUInt8( 3 ) );
  coOrds.z = ( buffer.readUInt16LE( 7 ) << 8 | buffer.readUInt8( 6 ) );

  for( ord in coOrds ) {
    if( coOrds[ ord ] & 0x800000 ) { // Negative number
      coOrds[ ord ] |= ~0xffffff;
    }
  }

  return 'v ' + ( coOrds.x / 100000 ) +
    ' ' + (  coOrds.y / 100000 ) +
    ' ' + (  coOrds.z / 100000 ) + '\n';
}

function getVertexIndex( buffer ) {
  return ' ' + ( buffer.readUInt16LE( ) + 1 ); // OBJ indices start at 1
}

function getColorAsRGB( buffer, type ) {
  var out = type + ( buffer.readUInt8( 0 ) / 255 ).toFixed( 5 ) + ' ' +
    ( buffer.readUInt8( 1 ) / 255 ).toFixed( 5 ) + ' ' +
    ( buffer.readUInt8( 2 ) / 255 ).toFixed( 5 );
  return out;
}

function getMaterialFromColor( color ) {
  return md5( color );
}

function decodeColor( buffer ) {
  var colors = {},
    matName = '';

  colors.diffuse = getColorAsRGB( buffer, 'Kd ' );

  matName = getMaterialFromColor( colors.diffuse );

  var known = haveMaterials[ matName ];

  if ( known ) {
    return {
      name: matName,
      cached: true
    };
  } else {
    haveMaterials[ matName ] = {
      name: matName,
      colors
    };
    return {
      material: haveMaterials[ matName ],
      cached: false
    };
  }
}

function writeMaterial( buffer ) {
  var mat = decodeColor( buffer );
  if ( mat.cached ) { // Don't write in the mtl file
    objStream.write( 'usemtl ' + mat.name + '\n' );
  } else {
    mtlStream.write( 'newmtl ' + mat.material.name + '\n' );
    mtlStream.write( mat.material.colors.diffuse + '\n' );
    objStream.write( 'usemtl ' + mat.material.name + '\n' );
  }
}

function decodeVertexGroup( buffer, offset ) {
  var length = buffer.readUInt8( offset + 1 ),
    i = 0,
    plus2 = offset + 2;

  for ( ; i < length; i++ ) {
    objStream.write( getVertex( buffer.slice( 9 * i + plus2, 9 * ( i + 1 ) + plus2 ) ) );
  }

  return 2 + length * 9;
}

function decodeTriangleGroup( buffer, offset ) {
  var length = buffer.readUInt8( offset + 5 ),
    i = 0,
    plus6 = offset + 6;

  writeMaterial( buffer.slice( offset + 2, offset + 5 ) );

  for ( ; i < length; i++ ) {
    if ( !( i % 3 ) ) {
      objStream.write( 'f' );
    }
    objStream.write( getVertexIndex( buffer.slice( 2 * i + plus6, 2 * ( i + 1 ) + plus6 ) ) );
    if ( i && !( ( i + 1 ) % 3 ) ) {
      objStream.write( '\n' );
    }
  }

  return 6 + length * 2;
}

function decodeTriangleStrip( buffer, offset ) {
  var length = buffer.readUInt8( offset + 5 ),
    i = 0,
    plus6 = offset + 6,
    a, b, c; // Unfortunate naming for triplets of vertex indices

  writeMaterial( buffer.slice( offset + 2, offset + 5 ) );

  for( ; i < length - 2; i++ ) {
    a = getVertexIndex( buffer.slice( 2 * i + plus6, 2 * ( i + 1 ) + plus6 ) );
    b = getVertexIndex( buffer.slice( 2 * ( i + 1 ) + plus6, 2 * ( i + 2 ) + plus6 ) );
    c = getVertexIndex( buffer.slice( 2 * ( i + 2 ) + plus6, 2 * ( i + 3 ) + plus6 ) );

    if( a === b || b === c || a === c ) {
      // Degenerate triangle - don't write this block to the file
      continue;
    } else {
      if( i % 2 ) {
        objStream.write( 'f' + b + a + c + '\n' );
      } else {
        objStream.write( 'f' + a + b + c + '\n' );
      }
    }
  }

  return 6 + length * 2;
}

function decodeConvexPolygon( buffer, offset ) {
  var length = buffer.readUInt8( offset + 5 ),
    i = 1,
    plus6 = offset + 6,
    a = getVertexIndex( buffer.slice( plus6, plus6 + 2 ) ),
    b, c;

  writeMaterial( buffer.slice( offset + 2, offset + 5 ) );

  for( ; i < length - 2; i++ ) {
    b = getVertexIndex( buffer.slice( 2 * ( i ) + plus6, 2 * ( i + 1 ) + plus6 ) );
    c = getVertexIndex( buffer.slice( 2 * ( i + 1 ) + plus6, 2 * ( i + 2 ) + plus6 ) );

    if( a === b || b === c || a === c ) {
      continue;
    } else {
      objStream.write( 'f' + a + b + c + '\n' );
    }
  }

  // Apparently, these primitives aren't completely closed like this
  // So we close them by joining last, 2nd and 1st points
  b = getVertexIndex( buffer.slice( plus6 + 2, plus6 + 4 ) );
  objStream.write( 'f' + c + b + a + '\n' );

  return 6 + length * 2;
}

function processFile( file ) {
  const inputFile = file || 'test';

  init( );

  fs.readFile( inputFile, ( e, data ) => {
    if ( e ) throw e;
    start( data );
  } );
}

function start( buffer ) {
  var inputBuffer = buffer,
    offset = 0,
    group = 0;

  while ( offset < inputBuffer.length ) {
    group = inputBuffer.readUInt8( offset );
    switch ( group ) {
    case 3:
      offset += decodeVertexGroup( inputBuffer, offset );
      break;
    case 11:
      offset += decodeTriangleGroup( inputBuffer, offset );
      break;
    case 12:
      offset += decodeTriangleStrip( inputBuffer, offset );
      break;
    case 13:
    case 14: // CONVEX_POLYGON, TRIANGLE_FAN are identical to process
             // Both seem to be deprecated in O2W, though
      offset += decodeConvexPolygon( inputBuffer, offset );
      break;
    default:
      console.error( 'Bad group: ', group, ' at offset ', offset );
      process.exit( 1 );
    }
  }

  objStream.end( );
  mtlStream.end( );

}

processFile( process.argv[ 2 ] );
