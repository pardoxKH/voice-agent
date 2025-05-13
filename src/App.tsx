import React, { useState, useEffect, useRef } from 'react';
import Vapi from '@vapi-ai/web';

// Get VAPI credentials from environment variables
const ASSISTANT_ID = '767fa3d4-7d4f-41ac-89e1-2dfd6032cdb0';
// const ASSISTANT_ID = 'e8888280-a21f-4ba5-ba69-bd5bc845a409';
const PUBLIC_KEY = 'e012973f-8a4e-4af2-911b-3e585c93c783';

// Generate droplets data outside component to prevent regeneration on re-renders
const generateDroplets = (count: number) => {
  return Array.from({ length: count }, () => ({
    x: Math.random() * 100,
    y: Math.random() * 100,
    duration: 5 + Math.random() * 10,
    xMovement: (Math.random() - 0.5) * 100,
    delay: Math.random() * 5,
  }));
};

const droplets = generateDroplets(50);

// Droplet component
const Droplet: React.FC<{ data: typeof droplets[0] }> = ({ data }) => (
  <div
    className="absolute w-1 h-1 bg-[#f8485e] rounded-full opacity-30 animate-droplet"
    style={{
      animationDelay: `${data.delay}s`,
      animationDuration: `${data.duration}s`,
      left: `${data.x}%`,
      top: `${data.y}%`,
      '--random-x': `${data.xMovement}px`,
    } as React.CSSProperties}
  />
);

// Waveform component
const Waveform: React.FC<{ volume: number }> = ({ volume }) => {
  const bars = 20; // Number of bars in the waveform
  const barArray = Array.from({ length: bars }, (_, i) => {
    const barHeight = Math.abs(Math.sin(i * 0.5) * volume * 100);
    return (
      <div
        key={i}
        className="w-1 bg-[#f8485e] rounded-full transition-all duration-100"
        style={{
          height: `${Math.max(5, barHeight)}px`,
          opacity: 0.5 + (volume * 0.5),
        }}
      />
    );
  });

  return (
    <div className="flex items-center justify-center gap-1 h-16">
      {barArray}
    </div>
  );
};

// Loading animation component
const LoadingRings: React.FC = () => (
  <div className="absolute inset-0 flex items-center justify-center">
    <div className="w-24 h-24 relative">
      <div className="absolute inset-0 border-2 border-[#f8485e] rounded-full animate-ping opacity-75"></div>
      <div className="absolute inset-0 border-2 border-[#f8485e] rounded-full animate-ping opacity-50" style={{ animationDelay: '0.5s' }}></div>
      <div className="absolute inset-0 border-2 border-[#f8485e] rounded-full animate-ping opacity-25" style={{ animationDelay: '1s' }}></div>
    </div>
  </div>
);

// TypewriterText component
const TypewriterText: React.FC<{ text: string }> = ({ text }) => {
  const [displayText, setDisplayText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) {
      const pauseTimeout = setTimeout(() => {
        setIsPaused(false);
        setDisplayText('');
        setCurrentIndex(0);
      }, 2000); // Pause for 2 seconds before restarting
      return () => clearTimeout(pauseTimeout);
    }

    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayText(prev => prev + text[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      }, 50); // Typing speed
      return () => clearTimeout(timeout);
    } else {
      setIsPaused(true);
    }
  }, [currentIndex, text, isPaused]);

  return (
    <p className="text-gray-400 text-base max-w-md mx-auto leading-relaxed">
      {displayText}
      <span className="animate-blink">|</span>
    </p>
  );
};

// Call to Action component
const CallToAction: React.FC = () => (
  <div className="text-center mb-12">
    <h2 className="text-4xl font-bold text-white mb-4 bg-gradient-to-r from-[#f8485e] to-[#ff6b6b] bg-clip-text text-transparent">
      Give Me a Call
    </h2>
    <p className="text-2xl text-gray-300 font-light tracking-wide">
      Your AI Assistant is All Ears
    </p>
    <div className="w-24 h-0.5 bg-gradient-to-r from-[#f8485e]/50 to-[#ff6b6b]/50 mx-auto mt-8 mb-6"></div>
    <TypewriterText text="This AI assistant helps provide preliminary diagnoses, book appointments, and support people who call the hospital — and it can even tell jokes when you need a smile 😉" />
  </div>
);

const App: React.FC = () => {
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [vapi, setVapi] = useState<Vapi | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMicPermissionGranted, setIsMicPermissionGranted] = useState<boolean | null>(null);
  const [volume, setVolume] = useState(0);
  const [userVolume, setUserVolume] = useState(0);
  const keepAliveInterval = useRef<NodeJS.Timeout | null>(null);
  const audioStream = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Function to analyze microphone input
  const analyzeMicrophoneInput = (stream: MediaStream) => {
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 64;
    source.connect(analyser);
    analyserRef.current = analyser;

    const updateVolume = () => {
      if (!analyserRef.current) return;
      
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      
      // Calculate average volume
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      setUserVolume(average / 128); // Normalize to 0-1 range
      
      animationFrameRef.current = requestAnimationFrame(updateVolume);
    };

    updateVolume();
  };

  // Cleanup audio analysis
  const cleanupAudioAnalysis = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }
  };

  // Check microphone permissions
  useEffect(() => {
    const checkMicPermission = async () => {
      try {
        const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        setIsMicPermissionGranted(result.state === 'granted');
        
        result.addEventListener('change', () => {
          setIsMicPermissionGranted(result.state === 'granted');
        });
      } catch (error) {
        console.error('Error checking microphone permission:', error);
        setIsMicPermissionGranted(false);
      }
    };

    checkMicPermission();
  }, []);

  useEffect(() => {
    console.log('Initializing VAPI...');
    // Initialize VAPI with public key
    const vapiInstance = new Vapi(PUBLIC_KEY);
    console.log('VAPI instance created:', vapiInstance);

    // Add event listeners
    vapiInstance.on('message', (message: any) => {
      console.log('Message event received:', message);
      if (message.role === 'user') {
        setTranscript(message.content);
      } else if (message.role === 'assistant') {
        setResponse(message.content);
      }
    });

    vapiInstance.on('error', (error: any) => {
      console.error('VAPI error:', error);
      setError(error.errorMsg || 'An error occurred');
      setIsListening(false);
      if (keepAliveInterval.current) {
        clearInterval(keepAliveInterval.current);
        keepAliveInterval.current = null;
      }
    });

    vapiInstance.on('call-end', () => {
      console.log('Call ended');
      setIsListening(false);
      setError(null);
      if (keepAliveInterval.current) {
        clearInterval(keepAliveInterval.current);
        keepAliveInterval.current = null;
      }
      // Stop audio stream when call ends
      if (audioStream.current) {
        audioStream.current.getTracks().forEach(track => track.stop());
        audioStream.current = null;
      }
    });

    vapiInstance.on('call-start', () => {
      console.log('Call started');
      // Log microphone state
      console.log('Microphone muted:', vapiInstance.isMuted());
      
      // Start keep-alive interval
      if (keepAliveInterval.current) {
        clearInterval(keepAliveInterval.current);
      }
      keepAliveInterval.current = setInterval(() => {
        if (vapiInstance && isListening) {
          console.log('Sending keep-alive message...');
          vapiInstance.send({
            type: 'add-message',
            message: {
              role: 'system',
              content: 'keep-alive',
            },
          });
        }
      }, 15000); // Send keep-alive every 15 seconds
    });

    vapiInstance.on('speech-start', () => {
      console.log('Speech started');
      // Log microphone state when speech starts
      console.log('Microphone muted during speech:', vapiInstance.isMuted());
    });

    vapiInstance.on('speech-end', () => {
      console.log('Speech ended');
    });

    vapiInstance.on('volume-level', (volume: number) => {
      console.log('Volume level:', volume);
      setVolume(volume);
      // Log microphone state with volume
      console.log('Microphone muted during volume update:', vapiInstance.isMuted());
    });

    setVapi(vapiInstance);

    return () => {
      console.log('Cleaning up VAPI instance...');
      if (keepAliveInterval.current) {
        clearInterval(keepAliveInterval.current);
      }
      if (audioStream.current) {
        audioStream.current.getTracks().forEach(track => track.stop());
      }
      vapiInstance.stop();
    };
  }, []);

  const requestMicPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      console.log('Audio stream obtained:', stream);
      console.log('Audio tracks:', stream.getAudioTracks());
      audioStream.current = stream;
      setIsMicPermissionGranted(true);
      return true;
    } catch (error) {
      console.error('Error requesting microphone permission:', error);
      setError('Microphone permission denied. Please allow microphone access to use this app.');
      setIsMicPermissionGranted(false);
      return false;
    }
  };

  // Modify the toggleListening function to handle audio analysis
  const toggleListening = async () => {
    console.log('Toggle listening clicked, current state:', { isListening, vapi });
    if (!vapi) {
      console.error('VAPI instance is null');
      return;
    }

    try {
      if (isListening) {
        console.log('Stopping VAPI...');
        if (keepAliveInterval.current) {
          clearInterval(keepAliveInterval.current);
          keepAliveInterval.current = null;
        }
        cleanupAudioAnalysis();
        if (audioStream.current) {
          audioStream.current.getTracks().forEach(track => track.stop());
          audioStream.current = null;
        }
        await vapi.stop();
        console.log('VAPI stopped successfully');
        setError(null);
        setIsListening(false);
      } else {
        setIsLoading(true);
        // Check microphone permission before starting
        if (isMicPermissionGranted === false) {
          const granted = await requestMicPermission();
          if (!granted) {
            setIsLoading(false);
            return;
          }
        }

        // Get the audio stream
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        console.log('Audio stream obtained:', stream);
        console.log('Audio tracks:', stream.getAudioTracks());
        
        // Store the stream and start audio analysis
        audioStream.current = stream;
        analyzeMicrophoneInput(stream);
        
        console.log('Starting VAPI...');
        setError(null);
        
        // Start VAPI with just the assistant ID
        await vapi.start(ASSISTANT_ID);
        
        // Ensure microphone is unmuted
        vapi.setMuted(false);
        console.log('Microphone muted after start:', vapi.isMuted());
        
        // Add a test message to verify communication
        vapi.send({
          type: 'add-message',
          message: {
            role: 'system',
            content: 'Microphone is ready',
          },
        });
        
        console.log('VAPI started successfully');
        setIsListening(true);
      }
    } catch (error: any) {
      console.error('Error toggling listening:', error);
      setError(error.message || 'Failed to toggle listening');
      setIsListening(false);
      cleanupAudioAnalysis();
      if (keepAliveInterval.current) {
        clearInterval(keepAliveInterval.current);
        keepAliveInterval.current = null;
      }
      if (audioStream.current) {
        audioStream.current.getTracks().forEach(track => track.stop());
        audioStream.current = null;
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupAudioAnalysis();
    };
  }, []);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background droplets */}
      {droplets.map((droplet, index) => (
        <Droplet key={index} data={droplet} />
      ))}

      <div className="z-10 w-full max-w-2xl mx-auto">
        {/* Content */}
        <div className="relative max-w-md w-full space-y-8 z-10 mx-auto">
          <div className="text-center">
            {/* Show CTA when not listening */}
            {!isListening && !response && <CallToAction />}

            <div className="mb-8">
              <h1 className="text-4xl font-bold text-white mb-2">
                <span className="text-[#f8485e]">Devoteam</span> Voice
              </h1>
              <p className="text-gray-400">AI Assistant</p>
            </div>
            
            {/* Error Message */}
            {error && (
              <div className="mb-4 p-4 bg-red-500/20 border border-red-500 rounded-lg backdrop-blur-sm">
                <p className="text-white">{error}</p>
              </div>
            )}

            {/* Microphone Permission Status */}
            {isMicPermissionGranted === false && (
              <div className="mb-4 p-4 bg-[#f8485e]/20 border border-[#f8485e] rounded-lg backdrop-blur-sm">
                <p className="text-white">Microphone access is required. Please allow microphone access in your browser settings.</p>
              </div>
            )}
            
            {/* Orb Button with Loading State */}
            <div className="relative">
              <button
                onClick={toggleListening}
                disabled={isLoading}
                className={`w-32 h-32 rounded-full transition-all duration-300 transform hover:scale-105 ${
                  isListening
                    ? 'bg-[#f8485e] animate-pulse shadow-lg shadow-[#f8485e]/50'
                    : 'bg-[#f8485e] hover:bg-[#f8485e]/90 shadow-lg'
                } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center justify-center h-full">
                  <span className="text-white text-lg font-semibold">
                    {isListening ? 'Stop' : 'Start'}
                  </span>
                </div>
              </button>
              {isLoading && <LoadingRings />}
            </div>

            {/* User's Voice Waveform */}
            {isListening && (
              <div className="mt-8 p-4 bg-[#2A2A2A]/80 rounded-lg border border-[#3A3A3A] backdrop-blur-sm">
                <p className="text-white text-sm mb-2 font-medium">Your Voice</p>
                <Waveform volume={userVolume} />
              </div>
            )}

            {/* Agent's Voice Waveform */}
            {isListening && (
              <div className="mt-4 p-4 bg-[#2A2A2A]/80 rounded-lg border border-[#3A3A3A] backdrop-blur-sm">
                <p className="text-white text-sm mb-2 font-medium">Assistant's Voice</p>
                <Waveform volume={volume} />
              </div>
            )}

            {/* Transcript */}
            {transcript && (
              <div className="mt-8 p-4 bg-[#2A2A2A]/80 rounded-lg border border-[#3A3A3A] backdrop-blur-sm">
                <h2 className="text-white text-lg font-semibold mb-2">You said:</h2>
                <p className="text-gray-300">{transcript}</p>
              </div>
            )}

            {/* Response */}
            {response && (
              <div className="mt-4 p-4 bg-[#2A2A2A]/80 rounded-lg border border-[#3A3A3A] backdrop-blur-sm">
                <h2 className="text-white text-lg font-semibold mb-2">Response:</h2>
                <p className="text-gray-300">{response}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App; 