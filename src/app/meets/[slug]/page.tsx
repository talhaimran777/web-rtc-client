'use client'

import { openMediaDevices } from '@/utils'
import { useParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'

const serverURL = process.env.NEXT_PUBLIC_SIGNALING_SERVER_URL as string

const socket = io(serverURL)
const peers = new Map<string, RTCPeerConnection>()
let stream: MediaStream

/**
 * Create a new peer connection
 * @param socketId - The socket id of the user to create a peer connection with
 * @returns - Promise<RTCPeerConnection>
 *
 */
const createNewPeerConnection = async (
    socketId: string
): Promise<RTCPeerConnection> => {
    const response = await fetch(
        `${process.env.NEXT_PUBLIC_METERED_CREDS_URL}?apiKey=${process.env.NEXT_PUBLIC_METERED_API_KEY}`
    )

    const iceServers = await response.json()

    console.log(
        `Creating a new peer connection for user ${socket.id} to be able to connect to user ${socketId}`
    )

    let pc = new RTCPeerConnection({
        iceServers: iceServers,
    })

    if (stream) {
        stream.getTracks().forEach((track) => {
            console.log('Adding track to peer', pc)
            pc.addTrack(track, stream)
        })
    }

    pc.ontrack = (e) => {
        console.log('Track Received', e, socketId)
        console.log('Streams', e.streams)

        e.streams.forEach((stream) => {
            console.log('Stream', stream)

            // Todo: Add a check for video type
            // Create a video element
            const videoElement = document.createElement('video')

            // Set attributes for the video element
            videoElement.id = socketId
            videoElement.autoplay = true
            videoElement.playsInline = true
            videoElement.controls = false
            videoElement.className = 'w-full bg-slate-900 rounded-lg'

            videoElement.srcObject = stream

            // Append the video element to a container (assuming a div with id 'videoContainer' exists)
            const element = document.getElementById('video-container')

            if (element) {
                element.appendChild(videoElement)
            }
        })
    }

    pc.onicecandidate = (event) => {
        console.log('Ice Candidate Received')

        if (event.candidate) {
            console.log(`Sending Ice Candidate to ${socketId}`, event.candidate)
            socket.emit('ice-candidate', event.candidate, socketId)
        }
    }

    return pc
}

/**
 * Handler: when an offer is received
 * @param offer - The offer
 * @param from - The socket id of the user who sent the offer
 */
const handleOffer = async (offer: RTCSessionDescription, from: string) => {
    console.log(`Offer Received from ${from}`, offer)

    const pc = await createNewPeerConnection(from)

    console.log('Setting Remote Description with this offer', offer)
    await pc.setRemoteDescription(new RTCSessionDescription(offer))

    const answer = await pc.createAnswer()

    console.log('Setting Local Description with this answer', answer)
    await pc.setLocalDescription(new RTCSessionDescription(answer))

    socket.emit('answer', answer, from)

    peers.set(from, pc)
}

/**
 * Handler: when an answer is received
 * @param answer - The answer
 * @param from - The socket id of the user who sent the answer
 */
const handleAnswer = async (answer: RTCSessionDescription, from: string) => {
    console.log(`Answer received from ${from}`, answer)

    const peer = peers.get(from)

    if (!peer) {
        console.error('no peerconnection')
        return
    }

    if (peer.signalingState !== 'stable') {
        console.log('Setting Remote Description with this answer', answer)
        await peer.setRemoteDescription(new RTCSessionDescription(answer))
    }
}

/**
 * Handler: when an ice candidate is received
 * @param candidate - The ice candidate
 * @param from - The socket id of the user who sent the ice candidate
 */
const handleIceCandidate = async (candidate: RTCIceCandidate, from: string) => {
    console.log(`Ice Candidate Received from ${from}`, candidate)

    const peer = peers.get(from)

    if (!peer) {
        console.error('no peerconnection')
        return
    }

    if (!candidate.candidate) {
        await peer.addIceCandidate(undefined)
    } else {
        console.log('Adding Ice Candidate', candidate)
        await peer.addIceCandidate(candidate)
    }
}

/**
 * Handler: when a new user joins
 * @param socketId - The socket id of the user who joined
 */
const handleUserJoined = async (socketId: string) => {
    console.log('A new user joined with socket id ', socketId)

    const pc = await createNewPeerConnection(socketId)

    console.log(`Creating an offer from ${socket.id} to ${socketId}`)
    const offer = await pc.createOffer()

    console.log('Setting Local Description with this offer', offer)
    await pc.setLocalDescription(new RTCSessionDescription(offer))

    socket.emit('offer', offer, socketId)

    peers.set(socketId, pc)
}

/**
 * Handler: when a user leaves
 * @param socketId - The socket id of the user who left
 */
const handleUserLeft = (socketId: string) => {
    console.log('User Left', socketId)
    console.log('Before Remove', peers)
    const peer = peers.get(socketId)

    if (peer) {
        peer.close()
        peers.delete(socketId)
        const videoToRemove = document.getElementById(socketId)

        if (videoToRemove) {
            document
                .getElementById('video-container')
                ?.removeChild(videoToRemove)
        }
    }

    console.log('After Remove', peers)
}

socket.on('connect', () => {
    console.log('Socket Connected')
})

socket.on('user-joined', handleUserJoined)

socket.on('user-left', handleUserLeft)

socket.on('offer', handleOffer)

socket.on('answer', handleAnswer)

socket.on('ice-candidate', handleIceCandidate)

const Lobby = () => {
    const { slug } = useParams()

    const [loading, setLoading] = useState(true)
    const [joined, setJoined] = useState(false)

    const videoRef = useRef<HTMLVideoElement>(null)
    const videoContainerRef = useRef<HTMLDivElement>(null)

    const getPermissions = async () => {
        try {
            stream = await openMediaDevices()
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const joinMeeting = () => {
        console.log('Joining Meeting Link')
        socket.emit('join-meet-link', slug)

        setJoined(true)
    }

    useEffect(() => {
        getPermissions()
    }, [])

    useEffect(() => {
        if (stream && videoRef.current) {
            videoRef.current.srcObject = stream
        }
    }, [stream])

    useEffect(() => {
        if (videoContainerRef.current) {
            console.log('Video Container', videoContainerRef.current)
        }
    }, [videoContainerRef.current])


    const videoElement = (
        <video
            ref={videoRef}
            className='w-full h-full bg-black rounded-md'
            autoPlay
            playsInline
            controls={false}
        ></video>
    )

    return (
        <div className='flex justify-center items-center min-h-screen p-4'>
            {!joined ? (
                <div className='h-full flex flex-col lg:flex-row lg:h-5/6 justify-between items-center gap-10'>
                    <div className='max-w-96 w-full'>{videoElement}</div>
                    {stream ? (
                        <div className='flex flex-col justify-center items-center gap-3'>
                            <p className='font-bold'>Ready to Join?</p>
                            <button
                                className='py-2 px-4 bg-blue-500 rounded-md text-white outline-none'
                                onClick={joinMeeting}
                            >
                                Join
                            </button>
                        </div>
                    ) : !loading ? (
                        <p>Please enable camera/mic</p>
                    ) : (
                        <p>Enabling camera</p>
                    )}
                </div>
            ) : (
                <div className='w-full lg:max-w-xl'>
                    <div
                        ref={videoContainerRef}
                        id='video-container'
                        className={`grid grid-cols-1 sm:grid-cols-2 gap-4 justify-center items-center`}
                    >
                        {videoElement}
                    </div>
                </div>
            )}
        </div>
    )
}

export default Lobby
