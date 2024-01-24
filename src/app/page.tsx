'use client'

import { useEffect } from 'react'

type Constraints = {
    video: boolean
    audio?: boolean
}

const tracks = new Map<string, MediaStreamTrack>()

const openMediaDevices = async (constraints: Constraints) => {
    return await navigator.mediaDevices.getUserMedia(constraints)
}

const getPermissions = async () => {
    try {
        const stream = await openMediaDevices({ video: true })
        console.log('Got MediaStream:', stream)

        stream.getTracks().forEach((track) => {
            tracks.set(track.kind, track)
        })

        const videoElement = document.querySelector('video#localVideo')
        videoElement.srcObject = stream
    } catch (error) {
        console.error('Error accessing media devices.', error)
    }
}

export default function Home() {
    return (
        <div>
            <video id='localVideo' autoPlay playsInline controls='false' />
            <div className='flex justify-start items-center gap-5'>
                <button className='p-2 bg-blue-500 rounded-md text-white' onClick={getPermissions}>Open Camera</button>
                <button
                    className='p-2 bg-blue-500 rounded-md text-white'
                    onClick={() => {
                        if (tracks.get('video') === undefined) {
                            alert("You don't have a video track");
                            return
                        }
                        const videoTrack = tracks.get('video')
                        videoTrack.enabled = !videoTrack.enabled
                    }}
                >
                    Toggle Video
                </button>
            </div>
        </div>
    )
}
