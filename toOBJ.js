const fs = require( 'fs' );
const outStream = fs.createWriteStream( ( process.argv[ 2 ] || 'out' ) + '.obj' );

function getVertex( buffer ) {
  return 'v ' + ( ( buffer.readInt16LE( 1 ) << 8 | buffer.readInt8( 0 ) ) / 100000 ) +
    ' ' + ( ( buffer.readInt16LE( 4 ) << 8 | buffer.readInt8( 3 ) ) / 100000 ) +
    ' ' + ( ( buffer.readInt16LE( 7 ) << 8 | buffer.readInt8( 6 ) ) / 100000 ) + '\n';
}

function getVertexIndex( buffer ) {
  return ' ' + ( buffer.readUInt16LE( ) + 1 ); // OBJ indices start at 1
}

function decodeVertexGroup( file, buffer, offset ) {
  var length = buffer.readInt8( offset + 1 ),
    i = 0;

  for ( ; i < length; i++ ) {
    outStream.write( getVertex( buffer.slice( 9 * i + 2, 9 * ( i + 1 ) + 2 ) ) );
  }

  return 2 + length * 9;
}

function decodeTriangleGroup( file, buffer, offset ) {
  var length = buffer.readInt8( offset + 8 ),
    i = 0,
    plus9 = offset + 9;

  for ( ; i < length; i++ ) {
    if( !(i % 3 ) ) {
      outStream.write( 'f' );
    }
    outStream.write( getVertexIndex( buffer.slice( 2 * i + plus9, 2 * ( i + 1 ) + plus9 ) ) );
    if( i && !( ( i + 1 ) % 3 ) ) {
      outStream.write( '\n' );
    }
  }

  return 9 + length * 2;
}

function processFile( file ) {
  const inputFile = file || 'test';

  fs.readFile( inputFile, ( e, data ) => {
    if ( e ) throw e;
    start( data );
  } );
}

function start( buffer ) {
  const outputFile = 'out';
  var inputBuffer = buffer,
    offset = 0,
    group = 0;

  while ( offset < inputBuffer.length ) {
    group = inputBuffer.readUInt8( offset );
    switch ( group ) {
    case 3:
      offset += decodeVertexGroup( outputFile, inputBuffer, offset );
      break;
    case 11:
      offset += decodeTriangleGroup( outputFile, inputBuffer, offset );
      break;
    default:
      console.error( 'Bad group: ', group, ' at offset ', offset );
      process.exit( 1 );
    }
  }

  outStream.end( );

}

processFile( process.argv[ 2 ] );
