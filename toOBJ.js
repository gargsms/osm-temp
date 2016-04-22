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
  return 'v ' + ( ( buffer.readInt16LE( 1 ) << 8 | buffer.readInt8( 0 ) ) / 100000 ) +
    ' ' + ( ( buffer.readInt16LE( 4 ) << 8 | buffer.readInt8( 3 ) ) / 100000 ) +
    ' ' + ( ( buffer.readInt16LE( 7 ) << 8 | buffer.readInt8( 6 ) ) / 100000 ) + '\n';
}

function getVertexIndex( buffer ) {
  return ' ' + ( buffer.readUInt16LE( ) + 1 ); // OBJ indices start at 1
}

function getColorAsRGB( buffer, type ) {
  var out = type + ( buffer.readUInt8( 0 ) / 255 )
    .toFixed( 5 ) + ' ' +
    ( buffer.readUInt8( 1 ) / 255 )
    .toFixed( 5 ) + ' ' +
    ( buffer.readUInt8( 2 ) / 255 )
    .toFixed( 5 );
  return out;
}

function getMaterialFromColor( color ) {
  return md5( color );
}

function decodeColor( buffer ) {
  var colors = {},
    matName = '';

  colors.ambient = getColorAsRGB( buffer.slice( 0, 3 ), 'Ka ' );
  colors.diffuse = getColorAsRGB( buffer.slice( 3 ), 'Kd ' );

  matName = getMaterialFromColor( colors.ambient + colors.diffuse );

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

function decodeVertexGroup( buffer, offset ) {
  var length = buffer.readInt8( offset + 1 ),
    i = 0;

  for ( ; i < length; i++ ) {
    objStream.write( getVertex( buffer.slice( 9 * i + 2, 9 * ( i + 1 ) + 2 ) ) );
  }

  return 2 + length * 9;
}

function decodeTriangleGroup( buffer, offset ) {
  var length = buffer.readInt8( offset + 8 ),
    i = 0,
    plus9 = offset + 9;

  var mat = decodeColor( buffer.slice( offset + 2, offset + 8 ) );
  if ( mat.cached ) { // Don't write in the mtl file
    objStream.write( 'usemtl ' + mat.name + '\n' );
  } else {
    mtlStream.write( 'newmtl ' + mat.material.name + '\n' );
    mtlStream.write( mat.material.colors.ambient + '\n' );
    mtlStream.write( mat.material.colors.diffuse + '\n' );
  }

  for ( ; i < length; i++ ) {
    if ( !( i % 3 ) ) {
      objStream.write( 'f' );
    }
    objStream.write( getVertexIndex( buffer.slice( 2 * i + plus9, 2 * ( i + 1 ) + plus9 ) ) );
    if ( i && !( ( i + 1 ) % 3 ) ) {
      objStream.write( '\n' );
    }
  }

  return 9 + length * 2;
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
    default:
      console.error( 'Bad group: ', group, ' at offset ', offset );
      process.exit( 1 );
    }
  }

  objStream.end( );

}

processFile( process.argv[ 2 ] );
