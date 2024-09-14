"use client";

import React, { useState, useRef, useEffect, ReactNode } from 'react';
import { SignInButton } from "@clerk/clerk-react";
import { useConvexAuth } from "convex/react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Lecture } from "../convex/posts";

import { TrashIcon, MagnifyingGlassIcon, PersonIcon } from "@radix-ui/react-icons";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Slider } from "@/components/ui/slider";

import { ModelSelector } from "./components/model-selector";
import { models, types } from "./data/models";

import { ScreenSpinner } from "@/app/ScreenSpinner";
import { Input } from "@/components/ui/input";
import { ModeToggle } from "./ModeToggle";
import { Badge } from "@/components/ui/badge";
import ReactMarkdown from 'react-markdown';
import { Audiogram } from "@/components/ui/line-chart";



import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Id } from "@/convex/_generated/dataModel";

import CollapsibleHeading from './components/CollapsibleHeading';


export default function HomePage() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const [generatingNotes, setGeneratingNotes] = useState(false);
  const [alertDialogOpen, setAlertDialogOpen] = useState(false);
  const BACKEND_ROOT_URL = "http://localhost:8000";

  const [concision, setConcision] = useState([0.5]);
  const [title, setTitle] = useState("");
  const [audioRecorder, setAudioRecorder] = useState<MediaRecorder | null>(null);
  const [noteContent, setNoteContent] = useState('');
  const audioChunks = useRef<Blob[]>([]);

  const [signalSupport, setSignalSupport] = useState({
    "Slow down": true,
    "Speed up": true,
    "Pause": true,
    "Unpause": true,
  });
  const nameEmojiMap: Record<string, string> = {
    "Slow down": "🙏",
    "Speed up": "👊",
    "Pause": "🤚",
    "Unpause": "👍",
  };

  const lectures = useQuery(api.posts.allLectures);
  const [selectedNote, setSelectedNote] = useState<Id<"lectures"> | null>(null);

  const [search, setSearch] = useState("");

  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [audioData, setAudioData] = useState<number[]>(new Array(100).fill(100));
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const isLookingHistory = useRef<boolean[]>([]);


  const [transcription, setTranscription] = useState("");
  const [summary, setSummary] = useState("");
  const createLecture = useMutation(api.posts.createLecture);

  useEffect(() => {
    if (cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
    }

    if (audioStream) {
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      const source = audioContextRef.current.createMediaStreamSource(audioStream);
      source.connect(analyserRef.current);

      const updateAudioData = () => {
        if (analyserRef.current) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteTimeDomainData(dataArray);
          setAudioData(prevData => {
            const newData = [...prevData.slice(1), Math.max(...Array.from(dataArray))];
            return newData;
          });
        }
        requestAnimationFrame(updateAudioData);
      };

      updateAudioData();
    }

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [cameraStream, audioStream]);

  const slowlySetConcision = async (newConcision: number[]) => {
    const step = (newConcision[0] - concision[0]) / 10; // Divide the change into 10 steps
    for (let i = 0; i < 10; i++) {
      setConcision(prev => [Math.min(Math.max(prev[0] + step, 0), 1)]); // Ensure concision stays between 0 and 1
      await new Promise(resolve => setTimeout(resolve, 1000)); // 50ms delay between steps
    }
    setConcision(newConcision); // Ensure we end up at the exact new concision value
  };

  useEffect(() => {
    if (generatingNotes) {
      const intervalId = setInterval(async () => {
        try {
          // Face detection
          const faceResponse = await fetch(`${BACKEND_ROOT_URL}/face-detection`);
          const faceData = await faceResponse.json();
          const isLooking = faceData.res;

          // Update isLooking history
          isLookingHistory.current = [...isLookingHistory.current.slice(-2), isLooking];

          // Gesture recognition
          const gestureResponse = await fetch(`${BACKEND_ROOT_URL}/gesture-recognition`);
          const gestureData = await gestureResponse.json();

          // Apply rules
          if (isLookingHistory.current.length === 3 && isLookingHistory.current.every(val => val === false)) {
            setAlertDialogOpen(true);
            setConcision([0.25]);
          } else if (gestureData.handsPrayer) { // Slow down
            setConcision([0.25]);
          } else if (gestureData.fist) { // Speed up
            setConcision([0.75]);
          } else if (gestureData.stopSign) { // Pause
            setConcision([1]);
          } else if (gestureData.thumbsUp) { // Unpause
            setConcision([0.5]);
          }
        } catch (error) {
          console.error("Error fetching detection data:", error);
        }
      }, 1000); // Check every second

      return () => clearInterval(intervalId);
    }
  }, [generatingNotes, BACKEND_ROOT_URL]);

  const startGeneratingNotes = async () => {
    setGeneratingNotes(true);
    if ('mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices) {
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" }
        });
        const audioStream = await navigator.mediaDevices.getUserMedia({
          audio: true
        });
        setCameraStream(videoStream);
        setAudioStream(audioStream);

        // Start processing audio
        processAudio(audioStream);
      } catch (error) {
        console.error("Error accessing audio:", error);
      }
    } else {
      console.error("Media devices and getUserMedia are not supported.");
    }
  };


  const processAudio = async (stream: MediaStream) => {
    const recorder = new MediaRecorder(stream);
    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => {
      chunks.push(e.data);
    };

    recorder.onstop = async () => {
      const audioBlob = new Blob(chunks, { type: 'audio/wav' });
      await sendAudioForTranscription(audioBlob);
    };

    // Record in 10-second intervals
    const interval = setInterval(() => {
      recorder.stop();
      try {
        recorder.start();
      } catch (error) {
        console.error("Error starting recording:", error);
      }
    }, 10000);

    recorder.start();

    // Clean up function
    return () => {
      clearInterval(interval);
      recorder.stop();
    };
  };

  const sendAudioForTranscription = async (audioBlob: Blob) => {
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.wav');

    try {
      const response = await fetch('http://localhost:8000/api/transcribe', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      setTranscription(prev => prev + ' ' + data.transcription);

      // Get summary
      const summaryResponse = await fetch('http://localhost:8000/api/summarize');
      const summaryData = await summaryResponse.json();
      setSummary(summaryData.summary);
    } catch (error) {
      console.error('Error sending audio for transcription:', error);
    }
  };

  const stopRecording = async (save: boolean = true) => {
    if (audioStream) {
      audioStream.getTracks().forEach(track => track.stop());
    }
    setCameraStream(null);
    setAudioStream(null);
    setGeneratingNotes(false);

    if (save) {
      try {
        await createLecture({
          title: title || 'Untitled Lecture',
          transcription: summary,
        });
      } catch (error) {
        console.error('Error saving lecture:', error);
      }
    }

    // Reset states
    setTranscription("");
    setSummary("");
  };

  const renderSummary = (): ReactNode => {
    if (!summary) {
      return "Your generated, realtime, hand-assisted notes will appear here...";
    }

    const sections = summary.split('\n\n');
    return sections.map((section, index) => {
      const [heading, ...contentLines] = section.split('\n');
      const content = contentLines.join('\n');
      return (
        <CollapsibleHeading 
          key={index} 
          heading={heading.replace(/^#+\s/, '')} 
          content={<p>{content}</p>} 
        />
      );
    });
  };

  isAuthenticated ? () : () 
  //  isLoading ? <ScreenSpinner /> : <div className="lds-screen-container"> <SignInButton /></div>;
  
}
