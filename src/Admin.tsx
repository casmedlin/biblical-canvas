import { useState, useEffect } from 'react';
import { Loader2, LogOut, LayoutGrid, List } from 'lucide-react';
import './App.css';

interface SharedDesign {
  timestamp: string;
  imageUrl?: string;
  config: any;
}

export default function Admin() {
  const [password, setPassword] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [designs, setDesigns] = useState<SharedDesign[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const getApiUrl = (path: string) => {
    return `${window.location.origin}${path}`;
  };

  useEffect(() => {
    const savedToken = sessionStorage.getItem('admin_token');
    if (savedToken) {
      setIsLoggedIn(true);
      void fetchDesigns(savedToken);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(getApiUrl('/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      if (!response.ok) {
        throw new Error('Invalid password');
      }

      const data = await response.json();
      setIsLoggedIn(true);
      sessionStorage.setItem('admin_token', data.token);
      void fetchDesigns(data.token);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDesigns = async (authToken: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(getApiUrl('/list'), {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch designs');
      }

      const data = await response.json();
      setDesigns(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('admin_token');
    setIsLoggedIn(false);
    setDesigns([]);
  };

  if (!isLoggedIn) {
    return (
      <div className="designer-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="control-group" style={{ maxWidth: '400px', width: '90%' }}>
          <h1 style={{ color: 'var(--primary)', marginBottom: '20px', textAlign: 'center' }}>Admin Login</h1>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              className="input-field"
              placeholder="Enter admin password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
            {error && <p style={{ color: '#ff8a80', fontSize: '0.8rem', marginBottom: '10px' }}>{error}</p>}
            <button type="submit" className="btn-primary" disabled={isLoading}>
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Login'}
            </button>
          </form>
          <div style={{ marginTop: '20px', textAlign: 'center' }}>
            <a href="/" style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>Back to Designer</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="designer-container" style={{ flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <header className="sidebar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexShrink: 0, position: 'sticky', top: 0, zIndex: 100, backgroundColor: 'var(--panel-bg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1 style={{ color: 'var(--primary)', margin: 0 }}>Shared Designs</h1>
          <span className="tiny-note" style={{ margin: 0 }}>{designs.length} submissions</span>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button 
            className={`btn-secondary ${viewMode === 'grid' ? 'active-preset' : ''}`} 
            style={{ width: 'auto', padding: '8px' }}
            onClick={() => setViewMode('grid')}
          >
            <LayoutGrid size={18} />
          </button>
          <button 
            className={`btn-secondary ${viewMode === 'list' ? 'active-preset' : ''}`} 
            style={{ width: 'auto', padding: '8px' }}
            onClick={() => setViewMode('list')}
          >
            <List size={18} />
          </button>
          <button className="btn-secondary" style={{ width: 'auto', padding: '8px 16px' }} onClick={handleLogout}>
            <LogOut size={18} style={{ marginRight: '8px' }} />
            Logout
          </button>
        </div>
      </header>

      <main style={{ flex: 1, padding: '24px', overflowY: 'auto', backgroundColor: 'var(--bg-color)', height: '100%' }}>
        {isLoading && <div style={{ textAlign: 'center', padding: '40px' }}><Loader2 className="animate-spin" size={40} style={{ color: 'var(--primary)' }} /></div>}
        
        {!isLoading && designs.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)' }}>
            No designs have been shared yet.
          </div>
        )}

        {viewMode === 'grid' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px', paddingBottom: '40px' }}>
            {designs.map((item, index) => (
              <div key={index} className="control-group" style={{ padding: '16px', margin: 0, display: 'flex', flexDirection: 'column', height: 'auto', minHeight: 'min-content' }}>
                {item.imageUrl && (
                  <div style={{ width: '100%', overflow: 'hidden', borderRadius: '8px', marginBottom: '12px', border: '1px solid var(--panel-border)', flexShrink: 0 }}>
                    <img 
                      src={item.imageUrl} 
                      alt="Shared design" 
                      style={{ width: '100%', height: 'auto', display: 'block', cursor: 'pointer', objectFit: 'contain' }}
                      onClick={() => window.open(item.imageUrl, '_blank')}
                    />
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '4px' }}>
                    {item.config.reference} ({item.config.versionLabel})
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontStyle: 'italic', marginBottom: '8px', lineBreak: 'anywhere' }}>
                    "{item.config.verse.substring(0, 100)}..."
                  </p>
                  <p style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>
                    Shared on: {new Date(item.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="control-group" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'rgba(255,255,255,0.05)', textAlign: 'left' }}>
                  <th style={{ padding: '12px' }}>Date</th>
                  <th style={{ padding: '12px' }}>Reference</th>
                  <th style={{ padding: '12px' }}>Verse Snippet</th>
                  <th style={{ padding: '12px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {designs.map((item, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid var(--panel-border)' }}>
                    <td style={{ padding: '12px' }}>{new Date(item.timestamp).toLocaleDateString()}</td>
                    <td style={{ padding: '12px' }}>{item.config.reference}</td>
                    <td style={{ padding: '12px', color: 'var(--text-dim)' }}>{item.config.verse.substring(0, 50)}...</td>
                    <td style={{ padding: '12px' }}>
                      <button 
                        className="btn-secondary" 
                        style={{ width: 'auto', padding: '4px 12px', fontSize: '0.75rem' }}
                        onClick={() => item.imageUrl && window.open(item.imageUrl, '_blank')}
                      >
                        View Image
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
      
      <div style={{ padding: '12px', textAlign: 'center', borderTop: '1px solid var(--panel-border)' }}>
        <a href="/" style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>Return to Biblical Canvas Designer</a>
      </div>
    </div>
  );
}
