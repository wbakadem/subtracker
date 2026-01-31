/**
 * Chart Components - SubTracker
 * Canvas-based charts without external dependencies
 */

const Charts = {
    // Create pie/doughnut chart
    createDoughnutChart(canvasId, data, options = {}) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;
        
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        
        // Set canvas size
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const radius = Math.min(centerX, centerY) - 20;
        const innerRadius = options.innerRadius || radius * 0.6;
        
        // Calculate total
        const total = data.reduce((sum, item) => sum + item.value, 0);
        
        // Draw segments
        let currentAngle = -Math.PI / 2;
        
        data.forEach(item => {
            const sliceAngle = (item.value / total) * 2 * Math.PI;
            const endAngle = currentAngle + sliceAngle;
            
            // Draw segment
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, currentAngle, endAngle);
            ctx.arc(centerX, centerY, innerRadius, endAngle, currentAngle, true);
            ctx.closePath();
            
            ctx.fillStyle = item.color;
            ctx.fill();
            
            // Draw border
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            currentAngle = endAngle;
        });
        
        // Draw center text
        if (options.centerText) {
            ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-primary');
            ctx.font = 'bold 16px Inter';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(options.centerText, centerX, centerY);
        }
        
        return {
            canvas,
            data,
            destroy() {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        };
    },
    
    // Create bar chart
    createBarChart(canvasId, data, options = {}) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;
        
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        
        const padding = { top: 20, right: 20, bottom: 40, left: 50 };
        const chartWidth = rect.width - padding.left - padding.right;
        const chartHeight = rect.height - padding.top - padding.bottom;
        
        const maxValue = Math.max(...data.map(d => d.value)) * 1.1;
        const barWidth = (chartWidth / data.length) * 0.6;
        const barSpacing = (chartWidth / data.length) * 0.4;
        
        // Draw axes
        ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--border-color');
        ctx.lineWidth = 1;
        
        // Y-axis
        ctx.beginPath();
        ctx.moveTo(padding.left, padding.top);
        ctx.lineTo(padding.left, rect.height - padding.bottom);
        ctx.stroke();
        
        // X-axis
        ctx.beginPath();
        ctx.moveTo(padding.left, rect.height - padding.bottom);
        ctx.lineTo(rect.width - padding.right, rect.height - padding.bottom);
        ctx.stroke();
        
        // Draw Y-axis labels
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-tertiary');
        ctx.font = '11px Inter';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        
        const ySteps = 5;
        for (let i = 0; i <= ySteps; i++) {
            const value = (maxValue / ySteps) * i;
            const y = rect.height - padding.bottom - (chartHeight / ySteps) * i;
            ctx.fillText(Math.round(value), padding.left - 8, y);
            
            // Grid line
            if (i > 0) {
                ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--border-light');
                ctx.beginPath();
                ctx.moveTo(padding.left, y);
                ctx.lineTo(rect.width - padding.right, y);
                ctx.stroke();
            }
        }
        
        // Draw bars
        data.forEach((item, index) => {
            const x = padding.left + (barWidth + barSpacing) * index + barSpacing / 2;
            const barHeight = (item.value / maxValue) * chartHeight;
            const y = rect.height - padding.bottom - barHeight;
            
            // Bar gradient
            const gradient = ctx.createLinearGradient(0, y, 0, rect.height - padding.bottom);
            gradient.addColorStop(0, item.color || '#6366f1');
            gradient.addColorStop(1, this.darkenColor(item.color || '#6366f1', 20));
            
            ctx.fillStyle = gradient;
            ctx.fillRect(x, y, barWidth, barHeight);
            
            // Bar border radius (top only)
            ctx.beginPath();
            ctx.moveTo(x, y + 4);
            ctx.arc(x + 4, y + 4, 4, Math.PI, Math.PI * 1.5);
            ctx.lineTo(x + barWidth - 4, y);
            ctx.arc(x + barWidth - 4, y + 4, 4, Math.PI * 1.5, 0);
            ctx.lineTo(x + barWidth, y + barHeight);
            ctx.lineTo(x, y + barHeight);
            ctx.closePath();
            ctx.fill();
            
            // X-axis label
            ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary');
            ctx.font = '10px Inter';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(item.label, x + barWidth / 2, rect.height - padding.bottom + 8);
        });
        
        return {
            canvas,
            data,
            destroy() {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        };
    },
    
    // Create line chart
    createLineChart(canvasId, data, options = {}) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;
        
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        
        const padding = { top: 20, right: 20, bottom: 40, left: 50 };
        const chartWidth = rect.width - padding.left - padding.right;
        const chartHeight = rect.height - padding.top - padding.bottom;
        
        const maxValue = Math.max(...data.map(d => d.value)) * 1.1;
        const minValue = 0;
        
        // Draw grid lines
        ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--border-light');
        ctx.lineWidth = 1;
        
        const ySteps = 5;
        for (let i = 0; i <= ySteps; i++) {
            const y = rect.height - padding.bottom - (chartHeight / ySteps) * i;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(rect.width - padding.right, y);
            ctx.stroke();
            
            // Y-axis label
            ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-tertiary');
            ctx.font = '11px Inter';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            const value = (maxValue / ySteps) * i;
            ctx.fillText(Math.round(value), padding.left - 8, y);
        }
        
        // Draw line
        const points = data.map((item, index) => ({
            x: padding.left + (chartWidth / (data.length - 1)) * index,
            y: rect.height - padding.bottom - ((item.value - minValue) / (maxValue - minValue)) * chartHeight
        }));
        
        // Draw area under line
        ctx.beginPath();
        ctx.moveTo(points[0].x, rect.height - padding.bottom);
        points.forEach(point => ctx.lineTo(point.x, point.y));
        ctx.lineTo(points[points.length - 1].x, rect.height - padding.bottom);
        ctx.closePath();
        
        const gradient = ctx.createLinearGradient(0, padding.top, 0, rect.height - padding.bottom);
        gradient.addColorStop(0, (options.color || '#6366f1') + '40');
        gradient.addColorStop(1, (options.color || '#6366f1') + '00');
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // Draw line
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        
        // Smooth curve
        for (let i = 1; i < points.length; i++) {
            const prev = points[i - 1];
            const curr = points[i];
            const cpX = (prev.x + curr.x) / 2;
            ctx.bezierCurveTo(cpX, prev.y, cpX, curr.y, curr.x, curr.y);
        }
        
        ctx.strokeStyle = options.color || '#6366f1';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
        
        // Draw points
        points.forEach((point, index) => {
            ctx.beginPath();
            ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
            ctx.fillStyle = options.color || '#6366f1';
            ctx.fill();
            
            ctx.beginPath();
            ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            
            // X-axis label
            ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary');
            ctx.font = '10px Inter';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(data[index].label, point.x, rect.height - padding.bottom + 8);
        });
        
        return {
            canvas,
            data,
            destroy() {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        };
    },
    
    // Helper: Darken color
    darkenColor(hex, percent) {
        const num = parseInt(hex.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.max((num >> 16) - amt, 0);
        const G = Math.max((num >> 8 & 0x00FF) - amt, 0);
        const B = Math.max((num & 0x0000FF) - amt, 0);
        return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
    },
    
    // Update category chart
    updateCategoryChart(categoryData) {
        const canvas = document.getElementById('category-canvas');
        const legend = document.getElementById('category-legend');
        
        if (!canvas || categoryData.length === 0) return;
        
        // Sort by value
        const sorted = [...categoryData].sort((a, b) => b.monthlyCost - a.monthlyCost);
        
        // Prepare chart data
        const data = sorted.map(c => ({
            value: c.monthlyCost,
            color: c.color
        }));
        
        // Create chart
        this.createDoughnutChart('category-canvas', data, {
            innerRadius: 0.65
        });
        
        // Update legend
        if (legend) {
            legend.innerHTML = sorted.map(c => `
                <div class="legend-item">
                    <span class="legend-color" style="background-color: ${c.color};"></span>
                    <span>${c.name} (${c.percentage}%)</span>
                </div>
            `).join('');
        }
    },
    
    // Update trend chart
    updateTrendChart(trendData) {
        if (!trendData || trendData.length === 0) return;
        
        const data = trendData.map(t => ({
            label: t.month,
            value: t.amount
        }));
        
        this.createLineChart('trend-canvas', data, {
            color: '#6366f1'
        });
    }
};

// Handle resize for charts
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        // Re-render charts if needed
        if (app.stats) {
            Charts.updateCategoryChart(app.stats.categoryBreakdown);
            Charts.updateTrendChart(app.stats.monthlyTrend);
        }
    }, 250);
});
