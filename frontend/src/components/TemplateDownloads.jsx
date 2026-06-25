import { Download } from 'lucide-react';
import api from '../api/axios';

export default function TemplateDownloads() {
    const downloadTemplate = async (type) => {
        try {
            const url = type === 'rabill' ? '/templates/rabill-v2' : '/templates/budget-v2';
            const response = await api.get(url, { responseType: 'blob' });
            
            const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = type === 'rabill' ? 'rabill_template_v2.xlsx' : 'budget_template_v2.xlsx';
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(downloadUrl);
        } catch (error) {
            console.error('Failed to download template', error);
            alert('Failed to download template. Please try again.');
        }
    };

    return (
        <div style={styles.container}>
            <h3 style={styles.title}>Download Updated Excel Templates</h3>
            <p style={styles.desc}>
                Version 2 templates now include "Schedule" and "Budget Schedule" sheets required for 3D Time Analytics.
            </p>
            <div style={styles.buttons}>
                <button style={styles.btn} onClick={() => downloadTemplate('rabill')}>
                    <Download size={18} /> RA Bill Template V2
                </button>
                <button style={{ ...styles.btn, background: '#10b981' }} onClick={() => downloadTemplate('budget')}>
                    <Download size={18} /> Budget Template V2
                </button>
            </div>
        </div>
    );
}

const styles = {
    container: {
        background: '#1e293b',
        border: '1px solid #334155',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px'
    },
    title: {
        fontSize: '18px',
        fontWeight: '600',
        color: '#f1f5f9',
        margin: '0 0 8px 0'
    },
    desc: {
        fontSize: '14px',
        color: '#94a3b8',
        margin: '0 0 16px 0'
    },
    buttons: {
        display: 'flex',
        gap: '12px'
    },
    btn: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: '#3b82f6',
        color: 'white',
        border: 'none',
        padding: '10px 20px',
        borderRadius: '8px',
        cursor: 'pointer',
        fontWeight: '600',
        fontSize: '14px'
    }
};
