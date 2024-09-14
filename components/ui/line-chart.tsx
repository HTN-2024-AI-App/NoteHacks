import React, { useEffect, useRef } from 'react';

interface AudiogramProps {
    data: number[];
    width?: number;
    height?: number;
}

export const Audiogram: React.FC<AudiogramProps> = ({ data, width = 300, height = 20 }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const draw = () => {
            ctx.clearRect(0, 0, width, height);

            // Draw center line
            ctx.beginPath();
            ctx.moveTo(0, height / 2);
            ctx.lineTo(width, height / 2);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.stroke();

            // Draw volume bars
            const barWidth = width / data.length;
            ctx.fillStyle = '#15803d';

            data.forEach((value, index) => {
                const barHeight = ((value - 100) * 3 / 255) * (height / 2);
                const x = width - (index + 1) * barWidth;
                ctx.fillRect(x, height / 2 - barHeight / 2, barWidth, barHeight);
            });
        };

        draw();
    }, [data, width, height]);

    return <canvas ref={canvasRef} width={width} height={height} />;
};
