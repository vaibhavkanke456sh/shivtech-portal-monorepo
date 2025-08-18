import React, { useEffect, useRef } from 'react';

interface ChartCardProps {
  title: string;
  type: 'bar' | 'doughnut';
  data: any;
  height?: number;
}

const ChartCard: React.FC<ChartCardProps> = ({ title, type, data, height = 200 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Simple chart implementation using Canvas API
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (type === 'bar') {
      drawBarChart(ctx, canvas, data);
    } else if (type === 'doughnut') {
      drawDoughnutChart(ctx, canvas, data);
    }
  }, [type, data]);

  const drawBarChart = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, chartData: any) => {
    const { labels, datasets } = chartData;
    const data = datasets[0].data;
    const maxValue = Math.max(...data);
    const barWidth = canvas.width / labels.length * 0.6;
    const barSpacing = canvas.width / labels.length * 0.4;

    ctx.fillStyle = '#10b981';
    
    data.forEach((value: number, index: number) => {
      const barHeight = (value / maxValue) * (canvas.height - 40);
      const x = index * (barWidth + barSpacing) + barSpacing / 2;
      const y = canvas.height - barHeight - 20;
      
      ctx.fillRect(x, y, barWidth, barHeight);
      
      // Draw labels
      ctx.fillStyle = '#374151';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(labels[index], x + barWidth / 2, canvas.height - 5);
      ctx.fillStyle = '#10b981';
    });
  };

  const drawDoughnutChart = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, chartData: any) => {
    const { labels, datasets } = chartData;
    const data = datasets[0].data;
    const colors = datasets[0].backgroundColor;
    const total = data.reduce((sum: number, value: number) => sum + value, 0);
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 20;
    const innerRadius = radius * 0.6;
    
    let currentAngle = -Math.PI / 2;
    
    data.forEach((value: number, index: number) => {
      const sliceAngle = (value / total) * 2 * Math.PI;
      
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
      ctx.arc(centerX, centerY, innerRadius, currentAngle + sliceAngle, currentAngle, true);
      ctx.closePath();
      
      ctx.fillStyle = colors[index];
      ctx.fill();
      
      currentAngle += sliceAngle;
    });
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <h3 className="text-lg font-semibold mb-4 text-gray-800">{title}</h3>
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={300}
          height={height}
          className="w-full max-w-sm mx-auto"
        />
      </div>
    </div>
  );
};

export default ChartCard;