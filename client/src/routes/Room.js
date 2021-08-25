import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import Peer from 'simple-peer';
import styled from 'styled-components';
import EventEmitter from 'events';

const Container = styled.div`
  padding: 20px;
  display: flex;
  height: 100vh;
  width: 90%;
  margin: auto;
  flex-wrap: wrap;
`;

const StyledVideo = styled.video`
  height: 40%;
  width: 50%;
`;

const Audio = (props) => {
  const ref = useRef();

  useEffect(() => {
    props.peer.on('stream', (stream) => {
      ref.current.srcObject = stream;
      ref.current.play();
    });
  }, []);

  return <audio controls ref={ref} />;
};

const videoConstraints = {
  height: window.innerHeight / 2,
  width: window.innerWidth / 2,
};

const ee = new EventEmitter();

const Room = (props) => {
  const [peers, setPeers] = useState(new Map());
  console.log('🚀 ~ file: Room.js ~ line 42 ~ Room ~ peers', peers);
  const [wsInstance, setWsInstance] = useState();

  function getAllUsersEvent(stream) {
    ee.on('getAllUsers', function (data) {
      if (Array.isArray(data)) {
        data.forEach((userId) => {
          const peer = createPeer(userId, stream);
          setPeers(new Map(peers.set(userId, peer)));
        });
      }
    });
  }

  function addPeer(incomingSignal, callerID, stream) {
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream,
    });

    peer.on('signal', (signal) => {
      wsInstance.send(
        JSON.stringify({
          event: 'returningSignal',
          data: {
            signal,
            callerID,
          },
        })
      );
    });

    peer.signal(incomingSignal);

    return peer;
  }

  function createPeer(userToSignal, stream) {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream,
    });

    peer.on('signal', (signal) => {
      wsInstance.send(
        JSON.stringify({
          event: 'sendingSignal',
          data: {
            userToSignal,
            signal,
          },
        })
      );
    });

    return peer;
  }

  function userJoin(stream) {
    ee.on('userJoinRoom', function (data) {
      const peer = addPeer(data.signal, data.callerID, stream);
      setPeers(new Map(peers.set(data.callerID, peer)));
    });
  }

  function receivingReturnedSignal() {
    ee.on('receivingReturnedSignal', function (data) {
      const peer = peers.get(data.id);
      peer && peer.signal(data.signal);
    });
  }

  function userLeft() {
    ee.on('userLeftRoom', function (data) {
      if (peers.has(data)) {
        peers.delete(data);
        setPeers(new Map(peers));
      }
    });
  }

  useEffect(() => {
    const ws = new WebSocket(
      'wss://f87d-103-156-42-200.ngrok.io/voice-chat?boardId=12345'
    );

    ws.onopen = function () {
      ws.send(
        JSON.stringify({
          event: 'getAllUsers',
        })
      );

      ws.onmessage = async function (event) {
        const dataBlob = event.data;
        if (dataBlob instanceof Blob) {
          const data = await dataBlob.text().then((text) => JSON.parse(text));
          ee.emit(data.event, data.data);
        }
      };
    };

    setWsInstance(ws);
  }, []);

  useEffect(() => {
    if (wsInstance) {
      navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
        getAllUsersEvent(stream);
        userJoin(stream);
        receivingReturnedSignal();
        userLeft();
      });
    }
  }, [wsInstance]);

  return (
    <Container>
      {[...peers.keys()].map((k) => (
        <Audio key={k} peer={peers.get(k)} />
      ))}
    </Container>
  );
};

export default Room;
