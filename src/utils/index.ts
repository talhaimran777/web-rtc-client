import { constraints } from "@/config"

export const openMediaDevices = async () => {
    return await navigator.mediaDevices.getUserMedia(constraints)
}
