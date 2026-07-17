'use client';

import { useState } from 'react';

interface CaptainNameModalProps {
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

export function CaptainNameModal({ onConfirm, onCancel }: CaptainNameModalProps) {
  const [name, setName] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onConfirm(name.trim() || '無名船長');
  }

  return (
    <div className="confirm-modal-backdrop" role="dialog" aria-modal="true" aria-label="為你的船長命名">
      <div className="confirm-modal-card">
        <p className="confirm-modal-kicker">新的旅程</p>
        <h2 className="confirm-modal-title">你的船長叫什麼名字？</h2>
        <form onSubmit={handleSubmit} className="captain-name-form">
          <input
            type="text"
            className="captain-name-input"
            placeholder="無名船長"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={12}
            autoFocus
          />
          <p className="captain-name-hint">最多 12 個字，留空則用「無名船長」</p>
          <div className="confirm-modal-actions">
            <button type="button" className="btn-ghost" onClick={onCancel}>取消</button>
            <button type="submit" className="btn">啟航</button>
          </div>
        </form>
      </div>
    </div>
  );
}
