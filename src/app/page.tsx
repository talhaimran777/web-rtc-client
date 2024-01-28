'use client'

import Pusher from 'pusher-js'

const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_APP_KEY || '', {
    cluster: 'ap2',
})

const channel = pusher.subscribe('web-rtc-channel')

type Constraints = {
    video: boolean
    audio?: boolean
}

const serverURL = process.env.NEXT_PUBLIC_SIGNALING_SERVER_URL

const tracks = new Map<string, MediaStreamTrack>()

let pc: RTCPeerConnection | null = null

let localStream: MediaStream

let localVideo: Element | null = null
let remoteVideo: Element | null = null

const openMediaDevices = async (constraints: Constraints) => {
    return await navigator.mediaDevices.getUserMedia(constraints)
}

const openCamera = async () => {
    try {
        localStream = await openMediaDevices({ video: true })

        localStream.getTracks().forEach((track) => {
            tracks.set(track.kind, track)
        })

        localVideo = document.querySelector('video#localVideo')
        remoteVideo = document.querySelector('video#remoteVideo')

        if (!localVideo || !('srcObject' in localVideo)) {
            console.error('no local video')
            return
        }

        localVideo.srcObject = localStream
    } catch (error) {
        console.error('Error accessing media devices.', error)
    }
}

const createNewPeerConnection = async (): Promise<RTCPeerConnection> => {
    const response = await fetch(
        `${process.env.NEXT_PUBLIC_METERED_CREDS_URL}?apiKey=${process.env.NEXT_PUBLIC_METERED_API_KEY}`
    )

    const iceServers = await response.json()

    pc = new RTCPeerConnection({
        iceServers: iceServers,
    })

    pc.onicecandidate = (event) => {
        console.log('Ice Candidate')

        if (event.candidate) {
            console.log('Sending Ice Candidate', event.candidate)
            try {
                fetch(`${serverURL}/ice-candidate`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        iceCandidate: event.candidate,
                    }),
                })
            } catch (e) {
                console.error('Error sending ice candidate', e)
            }
        }
    }

    pc.ontrack = (e) => {
        console.log('Track Received', e)

        if (!remoteVideo) {
            console.error('no remote video')
            return pc
        }

        if (!('srcObject' in remoteVideo)) {
            console.error('no remote video srcObject')
            return pc
        }

        remoteVideo.srcObject = e.streams[0]
    }

    if (!localStream) {
        console.error('no local stream')
        return pc
    }

    localStream.getTracks().forEach((track) => pc?.addTrack(track, localStream))

    return pc
}

const makeCall = async () => {
    pc = await createNewPeerConnection()

    const offer = await pc.createOffer()

    console.log('Setting Local Description with this offer', offer)
    await pc.setLocalDescription(new RTCSessionDescription(offer))

    try {
        await fetch(`${serverURL}/offer`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                offer: offer,
            }),
        })
    } catch (e) {
        console.error('Error sending offer', e)
    }
}

async function handleOffer(offer: RTCSessionDescriptionInit) {
    if (pc) {
        console.log('PC Exists')
        return
    }

    pc = await createNewPeerConnection()

    console.log('Setting Remote Description with this offer', offer)
    await pc.setRemoteDescription(new RTCSessionDescription(offer))

    const answer = await pc.createAnswer()

    console.log('Setting Local Description with this answer', answer)
    await pc.setLocalDescription(new RTCSessionDescription(answer))

    try {
        await fetch(`${serverURL}/answer`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                answer: answer,
            }),
        })
    } catch (e) {
        console.error('Error sending answer', e)
    }
}

async function handleAnswer(answer: RTCSessionDescriptionInit) {
    if (!pc) {
        console.error('no peerconnection')
        return
    }

    if (pc.signalingState === 'stable') {
        console.error('stable state')
        return
    }

    console.log('Setting Remote Description with this answer', answer)
    await pc.setRemoteDescription(new RTCSessionDescription(answer))
}

async function handleCandidate(candidate: RTCIceCandidate) {
    if (!pc) {
        console.error('no peerconnection')
        return
    }

    console.log('Adding Ice Candidate', candidate)

    if (!candidate.candidate) {
        await pc.addIceCandidate(undefined)
    } else {
        await pc.addIceCandidate(candidate)
    }
}

export default function Home() {
    channel.bind('offer', async (data: { message: RTCSessionDescription }) => {
        console.log('Offer Received', data.message)
        await handleOffer(data.message)
    })

    channel.bind('answer', async (data: { message: RTCSessionDescription }) => {
        console.log('Answer Received', data.message)
        await handleAnswer(data.message)
    })

    channel.bind(
        'ice-candidate',
        async (data: { message: RTCIceCandidate }) => {
            console.log('Ice Candidate Received', data.message)
            if (!data.message) {
                return
            }
            try {
                await handleCandidate(data.message)
            } catch (e) {
                console.error('Error adding received ice candidate', e)
            }
        }
    )

    return (
        <div className='min-h-screen py-4 flex justify-center items-center'>
            <div className='mx-4'>
                <div className='flex flex-wrap justify-center lg:justify-between items-center gap-5 mx-auto'>
                    <video
                        id='localVideo'
                        autoPlay
                        playsInline
                        controls={false}
                        className='h-full border-2 border-black'
                    />
                    <video
                        id='remoteVideo'
                        autoPlay
                        playsInline
                        controls={false}
                        className='h-full border-2 border-black'
                    />
                </div>

                <div className='flex justify-center items-center gap-5 mt-5'>
                    <button
                        className='p-2 bg-blue-500 rounded-md text-white'
                        onClick={openCamera}
                    >
                        Open Camera
                    </button>
                    <button
                        className='p-2 bg-blue-500 rounded-md text-white'
                        onClick={makeCall}
                    >
                        Make Call
                    </button>
                </div>
            </div>
        </div>
    )
}
