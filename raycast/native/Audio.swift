import AVFoundation
import Foundation

// stdout is headerless 48 kHz mono Float32 PCM; stderr is JSON lifecycle events.
let engine = AVAudioEngine()
func event(_ type: String, _ message: String) {
    let data = try! JSONSerialization.data(withJSONObject: ["type": type, "message": message])
    FileHandle.standardError.write(data + Data([10]))
}
func fail(_ message: String) -> Never { event("error", message); exit(1) }

if CommandLine.arguments.contains("--probe") {
    let status = AVCaptureDevice.authorizationStatus(for: .audio)
    event("permission", String(describing: status))
    exit(0)
}

func startCapture() {
    do {
        let input = engine.inputNode
        let inputFormat = input.outputFormat(forBus: 0)
        guard inputFormat.sampleRate > 0, inputFormat.channelCount > 0 else { fail("No microphone is available.") }
        let outputFormat = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: 48000, channels: 1, interleaved: false)!
        guard let converter = AVAudioConverter(from: inputFormat, to: outputFormat) else { fail("Cannot convert microphone audio.") }
        // Disable voice processing: acoustic modem chirps must reach the decoder intact.
        input.installTap(onBus: 0, bufferSize: 1024, format: inputFormat) { buffer, _ in
            let capacity = AVAudioFrameCount(ceil(Double(buffer.frameLength) * 48000 / inputFormat.sampleRate) + 64)
            guard let output = AVAudioPCMBuffer(pcmFormat: outputFormat, frameCapacity: capacity) else { return }
            var supplied = false
            var error: NSError?
            let result = converter.convert(to: output, error: &error) { _, status in
                if supplied { status.pointee = .noDataNow; return nil }
                supplied = true
                status.pointee = .haveData
                return buffer
            }
            if result == .error { fail(error?.localizedDescription ?? "Microphone conversion failed.") }
            guard output.frameLength > 0, let samples = output.floatChannelData?[0] else { return }
            FileHandle.standardOutput.write(Data(bytes: samples, count: Int(output.frameLength) * 4))
        }
        try engine.start()
        event("ready", "Listening at 48000 Hz")
        NotificationCenter.default.addObserver(forName: .AVAudioEngineConfigurationChange, object: engine, queue: .main) { _ in
            fail("The audio device changed. Start listening again.")
        }
    } catch { fail(error.localizedDescription) }
}

switch AVCaptureDevice.authorizationStatus(for: .audio) {
case .authorized: startCapture()
case .notDetermined:
    event("permission", "Allow microphone access in the macOS permission prompt.")
    AVCaptureDevice.requestAccess(for: .audio) { granted in
        DispatchQueue.main.async {
            if granted { startCapture() }
            else { fail("Microphone permission denied. Allow Raycast or your terminal in System Settings > Privacy & Security > Microphone.") }
        }
    }
default: fail("Microphone permission denied. Allow Raycast or your terminal in System Settings > Privacy & Security > Microphone.")
}
RunLoop.main.run()
