'use client';

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
  
    // Split sections and filter out empty lines
    
    const sections = summary.split('#').filter(section => section.trim() !== '' || section !== "#");
    
    return sections.map((section, index) => {
      // Split each section into heading and content, filtering out empty content lines
      if (section.trim() === '' || section.length <= 1) return null;
      const [heading, ...contentLines] = section.split('\n').filter(line => line.trim() !== '');
      const content = contentLines.join(' '); // Join content lines into a single paragraph

      if (content.trim() === '') return null;
  
      return (
        <CollapsibleHeading 
          key={index} 
          heading={heading} 
          content={<p>{content}</p>} 
        />
      );
    });
  };
  

  return isAuthenticated ? (
    <>
      <div className="h-full flex flex-col">
        <AlertDialog open={alertDialogOpen} >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>You seem distracted!</AlertDialogTitle>
              <AlertDialogDescription>
                Our system detected that you seem distracted. We&apos;ve decreased note concision to make the notes more understandable. Let us know when you&apos;re back!
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => setAlertDialogOpen(false)}>Continue</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <div className="flex flex-col items-start justify-between space-y-2 py-4 sm:flex-row sm:items-center sm:space-y-0 md:h-16">
          <h2 className="text-lg font-semibold flex gap-x-2 items-center cursor-pointer"><svg xmlns="http://www.w3.org/2000/svg" className="icon icon-tabler icon-tabler-note size-8 m-auto dark:!text-white" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
            <path d="M13 20l7 -7" />
            <path d="M13 20v-6a1 1 0 0 1 1 -1h6v-7a2 2 0 0 0 -2 -2h-12a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h7" />
          </svg>NoteHacks</h2>
          <div className="ml-auto flex w-full space-x-2 sm:justify-end items-center">
            <ModeToggle />

            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 size-6" />
              <Input type="text" placeholder="Search your notes..." className="!pl-10 min-w-[20rem]" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Button variant="outline" size="icon" className="rounded-full !p-0"><PersonIcon strokeWidth={2} /></Button>
          </div>
        </div>
        <Separator />
        <div className="h-full py-6 grid grid-cols-4">
          <div className={"h-full items-stretch col-span-3 overflow-y-hidden pr-8 flex flex-row gap-x-4 w-full"}>
            <div className={"hidden flex-col space-y-4 sm:flex md:order-2 h-full w-[300px] mx-auto " + (selectedNote ? "!hidden" : "")}>
              {/* title, model, concision, signal support */}
              {selectedNote === null && (
                <>
                  <div className="grid gap-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="maxlength" className="font-semibold">Title</Label>
                    </div>
                    <Input type="text" placeholder="CS 3110, Lecture 2" value={title} onChange={(e) => setTitle(e.target.value)} />
                  </div>

                  <ModelSelector types={types} models={models} />

                  <HoverCard openDelay={200}>
                    <HoverCardTrigger asChild>
                      <div className="grid gap-4">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="maxlength" className="font-semibold">Concision</Label>
                          <span className="w-12 rounded-md border border-transparent px-2 py-0.5 text-right text-sm text-muted-foreground hover:border-border">
                            {concision}
                          </span>
                        </div>
                        <Slider
                          id="maxlength"
                          max={1}
                          value={concision}
                          step={0.01}
                          onValueChange={slowlySetConcision}
                          className="[&_[role=slider]]:h-4 [&_[role=slider]]:w-4"
                          aria-label="Concision"
                        />
                      </div>
                    </HoverCardTrigger>
                    <HoverCardContent
                      align="start"
                      className="w-[260px] text-sm"
                      side="left"
                    >
                      How concise the notes should be, by default. May be adjusted based on hand signals or distraction.
                    </HoverCardContent>
                  </HoverCard>

                  <div className="!pt-0 !h-0" />

                  <HoverCard openDelay={200}>
                    <HoverCardTrigger asChild>
                      <>
                        <Label className="flex-start ml-0 mr-auto text-start font-semibold">Signal Support</Label>
                        <div className="flex flex-col gap-y-2 items-start">
                          {Object.entries(signalSupport).map(([key, value]) => (
                            <div key={key} className="flex items-center justify-between gap-x-2 !-my-2">
                              <Input type="checkbox" checked={value} className="accent-black cursor-pointer" id={key} onChange={(e) => setSignalSupport({ ...signalSupport, [key]: e.target.checked })} />
                              <Label className="flex items-center gap-x-2 w-max flex-nowrap text-nowrap" htmlFor={key}>{key} {nameEmojiMap[key]}</Label>
                            </div>
                          ))}
                        </div>
                      </>
                    </HoverCardTrigger>
                    <HoverCardContent
                      align="start"
                      className="w-[260px] text-sm"
                      side="left"
                    >
                      Whether the notes should be generated with signal support, by default. May be adjusted based on hand signals or distraction.
                    </HoverCardContent>
                  </HoverCard>

                  <div className="flex-grow" />
                </>
              )}

              {/* Add camera feed and audiogram */}
              {(cameraStream || audioStream) && (
                <div className="mt-4 !mb-[3.5rem] flex flex-col gap-4">
                  {cameraStream && (
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-auto rounded-md"
                    />
                  )}
                </div>
              )}
              {!cameraStream && !audioStream && (
                <div className="mt-4 !mb-[3.25rem] bg-gray-200 border border-gray-300 rounded-md dark:bg-gray-800 dark:border-gray-700 prose dark:prose-invert !max-w-full h-40 text-center items-center flex justify-center italic text-xs">
                  <p>No recording in progress.</p>
                </div>
              )}
            </div>
            <div className="flex h-full flex-col space-y-4 w-full">
              {selectedNote === null ? (
                <div className="min-h-[400px] flex-1 p-4 md:min-h-[700px] lg:min-h-[700px] bg-gray-200 border border-gray-300 rounded-md dark:bg-gray-800 dark:border-gray-700 prose dark:prose-invert !max-w-full overflow-y-auto">
                {renderSummary()}
              </div>
              ) : (
                <div className="min-h-[400px] flex-1 p-4 md:min-h-[700px] lg:min-h-[700px] bg-gray-200 border border-gray-300 rounded-md dark:bg-gray-800 dark:border-gray-700 prose dark:prose-invert max-h-[700px] overflow-y-scroll !max-w-full prose-headings:mt-0 prose-headings:mb-4 prose-p:mt-0 prose-p:mb-2 !leading-snug">
                  <ReactMarkdown>
                    {lectures?.find(item => item._id === selectedNote)?.transcription || ''}
                  </ReactMarkdown>
                </div>
              )}
              <div className="flex items-center space-x-2">
                {selectedNote === null ? (
                  generatingNotes ? (
                    <Button onClick={() => stopRecording(true)}>Save recording</Button>
                  ) : (
                    <Button onClick={startGeneratingNotes}>Start recording</Button>
                  )
                ) : (
                  <Button variant="outline" onClick={() => setSelectedNote(null)}>Back to new note</Button>
                )}
                {!selectedNote && generatingNotes && <>
                  <Button variant="destructive" onClick={() => stopRecording(false)}>
                    <span className="sr-only">Cancel generation</span>
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                  {audioStream && (
                    <div className="w-full">
                      <Audiogram data={audioData} width={550} height={40} />
                    </div>
                  )}</>}
              </div>
            </div>
          </div>
          <div className="hidden flex-col space-y-4 sm:flex md:order-2 h-full overflow-y-auto border-l pl-8 border-gray-200 dark:border-gray-800">
            <h2 className="font-semibold text-center underline">Past Notes</h2>
            <div className="flex flex-col gap-y-4 items-center justify-between max-h-[700px] overflow-y-auto">
              {lectures === undefined ? (
                <ScreenSpinner />
              ) : (
                lectures
                  .filter((item: Lecture) =>
                    item.title.toLowerCase().includes(search.toLowerCase())
                  )
                  .map((item: Lecture) => (
                    <Badge
                      key={item._id}
                      variant={selectedNote === item._id ? "default" : "outline"}
                      className="flex flex-col text-center items-center justify-between !text-sm cursor-pointer"
                      onClick={() => setSelectedNote(item._id)}
                    >
                      <span className="italic mb-0.5">
                        {item.title}
                      </span><span>{new Date(item._creationTime).toLocaleTimeString()}&nbsp;&nbsp;&bull;&nbsp;&nbsp;{new Date(item._creationTime).toLocaleDateString()}
                      </span>
                    </Badge>
                  ))
              )}
            </div>
          </div>
        </div>
      </div >
    </>
  ) : (
    isLoading ? <ScreenSpinner /> : <div className="lds-screen-container"><SignInButton /></div>
  );
}
