'use client'

import { useRouter } from 'next/navigation'
import { io } from 'socket.io-client'

const serverURL = process.env.NEXT_PUBLIC_SIGNALING_SERVER_URL as string

const socket = io(serverURL)

export default function Home() {
    const router = useRouter()

    socket.on('meet-link-created', (meetLink: string) => {
        console.log('Meet Link Received', meetLink)
        router.push(`/meets/${meetLink}`)
    })

    const createMeetLink = () => {
        socket.emit('create-meet-link')
    }

    return (
        <div className='min-h-screen py-4 flex justify-center items-center'>
            <div className='mx-4'>
                <button
                    className='py-2 px-3 bg-blue-500 rounded-md text-white'
                    onClick={createMeetLink}
                >
                    New Meeting
                </button>
            </div>
        </div>
    )
}
