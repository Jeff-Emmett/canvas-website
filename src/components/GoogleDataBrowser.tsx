import { useState, useEffect, useRef } from 'react';
import { GoogleDataService, type GoogleService, type ShareableItem } from '../lib/google';

interface GoogleDataBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  onAddToCanvas: (items: ShareableItem[], position: { x: number; y: number }) => void;
  isDarkMode: boolean;
}

const SERVICE_ICONS: Record<GoogleService, string> = {
  gmail: '📧',
  drive: '📁',
  photos: '📷',
  calendar: '📅',
};

const SERVICE_NAMES: Record<GoogleService, string> = {
  gmail: 'Gmail',
  drive: 'Drive',
  photos: 'Photos',
  calendar: 'Calendar',
};

export function GoogleDataBrowser({
  isOpen,
  onClose,
  onAddToCanvas,
  isDarkMode,
}: GoogleDataBrowserProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<GoogleService>('gmail');
  const [items, setItems] = useState<ShareableItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [serviceCounts, setServiceCounts] = useState<Record<GoogleService, number>>({
    gmail: 0,
    drive: 0,
    photos: 0,
    calendar: 0,
  });

  // Dark mode aware colors
  const colors = isDarkMode ? {
    bg: '#1a1a1a',
    cardBg: '#252525',
    cardBorder: '#404040',
    text: '#e4e4e4',
    textMuted: '#a1a1aa',
    textHeading: '#f4f4f5',
    hoverBg: '#333333',
    selectedBg: 'rgba(99, 102, 241, 0.2)',
    selectedBorder: 'rgba(99, 102, 241, 0.5)',
    tabActiveBg: '#3b82f6',
    tabActiveText: '#ffffff',
    tabInactiveBg: '#333333',
    tabInactiveText: '#a1a1aa',
    inputBg: '#333333',
    inputBorder: '#404040',
    btnPrimaryBg: '#6366f1',
    btnPrimaryText: '#ffffff',
    btnSecondaryBg: '#333333',
    btnSecondaryText: '#e4e4e4',
  } : {
    bg: '#ffffff',
    cardBg: '#f9fafb',
    cardBorder: '#e5e7eb',
    text: '#374151',
    textMuted: '#6b7280',
    textHeading: '#1f2937',
    hoverBg: '#f3f4f6',
    selectedBg: 'rgba(99, 102, 241, 0.1)',
    selectedBorder: 'rgba(99, 102, 241, 0.4)',
    tabActiveBg: '#3b82f6',
    tabActiveText: '#ffffff',
    tabInactiveBg: '#f3f4f6',
    tabInactiveText: '#6b7280',
    inputBg: '#ffffff',
    inputBorder: '#e5e7eb',
    btnPrimaryBg: '#6366f1',
    btnPrimaryText: '#ffffff',
    btnSecondaryBg: '#f3f4f6',
    btnSecondaryText: '#374151',
  };

  // Load items when tab changes
  useEffect(() => {
    if (!isOpen) return;

    const loadItems = async () => {
      setLoading(true);
      setItems([]);
      setSelectedIds(new Set());

      try {
        const service = GoogleDataService.getInstance();
        const shareService = service.getShareService();

        if (shareService) {
          const shareableItems = await shareService.listShareableItems(activeTab, 100);
          setItems(shareableItems);
        }

        // Also update counts
        const counts = await service.getStoredCounts();
        setServiceCounts(counts);
      } catch (error) {
        console.error('Failed to load items:', error);
      } finally {
        setLoading(false);
      }
    };

    loadItems();
  }, [isOpen, activeTab]);

  // Handle escape key and click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Toggle item selection
  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Select/deselect all
  const selectAll = () => {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map((i) => i.id)));
    }
  };

  // Filter items by search query
  const filteredItems = items.filter((item) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.title.toLowerCase().includes(query) ||
      (item.preview && item.preview.toLowerCase().includes(query))
    );
  });

  // Handle add to canvas
  const handleAddToCanvas = () => {
    const selectedItems = items.filter((i) => selectedIds.has(i.id));
    if (selectedItems.length === 0) return;

    // Calculate center of viewport for placement
    const position = { x: 200, y: 200 }; // Default position, will be adjusted by caller
    onAddToCanvas(selectedItems, position);
    onClose();
  };

  // Format date
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100002,
      }}
    >
      <div
        ref={modalRef}
        style={{
          backgroundColor: colors.bg,
          borderRadius: '12px',
          width: '90%',
          maxWidth: '600px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: `1px solid ${colors.cardBorder}`,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: `1px solid ${colors.cardBorder}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>🔐</span>
            <h2 style={{ fontSize: '16px', fontWeight: '600', color: colors.textHeading, margin: 0 }}>
              Your Private Data
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              color: colors.textMuted,
              padding: '4px',
            }}
          >
            ×
          </button>
        </div>

        {/* Service tabs */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            padding: '12px 20px',
            borderBottom: `1px solid ${colors.cardBorder}`,
          }}
        >
          {(['gmail', 'drive', 'photos', 'calendar'] as GoogleService[]).map((service) => (
            <button
              key={service}
              onClick={() => setActiveTab(service)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '500',
                backgroundColor: activeTab === service ? colors.tabActiveBg : colors.tabInactiveBg,
                color: activeTab === service ? colors.tabActiveText : colors.tabInactiveText,
                transition: 'all 0.15s ease',
              }}
            >
              <span>{SERVICE_ICONS[service]}</span>
              <span>{SERVICE_NAMES[service]}</span>
              {serviceCounts[service] > 0 && (
                <span
                  style={{
                    fontSize: '11px',
                    padding: '2px 6px',
                    borderRadius: '10px',
                    backgroundColor: activeTab === service ? 'rgba(255,255,255,0.2)' : colors.cardBorder,
                  }}
                >
                  {serviceCounts[service]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search and actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 20px',
            borderBottom: `1px solid ${colors.cardBorder}`,
          }}
        >
          <div style={{ flex: 1, position: 'relative' }}>
            <span
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: '14px',
              }}
            >
              🔍
            </span>
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                borderRadius: '8px',
                border: `1px solid ${colors.inputBorder}`,
                backgroundColor: colors.inputBg,
                color: colors.text,
                fontSize: '13px',
                outline: 'none',
              }}
            />
          </div>
          <button
            onClick={selectAll}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: `1px solid ${colors.cardBorder}`,
              backgroundColor: colors.btnSecondaryBg,
              color: colors.btnSecondaryText,
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            {selectedIds.size === filteredItems.length && filteredItems.length > 0
              ? 'Clear'
              : 'Select All'}
          </button>
        </div>

        {/* Items list */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px 12px',
          }}
        >
          {loading ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px',
                color: colors.textMuted,
              }}
            >
              Loading...
            </div>
          ) : filteredItems.length === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px',
                color: colors.textMuted,
              }}
            >
              <span style={{ fontSize: '32px', marginBottom: '12px' }}>{SERVICE_ICONS[activeTab]}</span>
              <p style={{ fontSize: '14px' }}>No {SERVICE_NAMES[activeTab]} data imported yet</p>
              <a
                href="/google"
                style={{ fontSize: '13px', color: '#3b82f6', marginTop: '8px' }}
              >
                Import data →
              </a>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => toggleSelection(item.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    backgroundColor: selectedIds.has(item.id) ? colors.selectedBg : 'transparent',
                    border: selectedIds.has(item.id)
                      ? `1px solid ${colors.selectedBorder}`
                      : '1px solid transparent',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!selectedIds.has(item.id)) {
                      e.currentTarget.style.backgroundColor = colors.hoverBg;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!selectedIds.has(item.id)) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  {/* Checkbox */}
                  <div
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '4px',
                      border: `2px solid ${selectedIds.has(item.id) ? '#6366f1' : colors.cardBorder}`,
                      backgroundColor: selectedIds.has(item.id) ? '#6366f1' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {selectedIds.has(item.id) && (
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        stroke="white"
                        strokeWidth="2"
                      >
                        <path d="M2 6l3 3 5-6" />
                      </svg>
                    )}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '13px',
                        fontWeight: '500',
                        color: colors.text,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {item.title}
                    </div>
                    {item.preview && (
                      <div
                        style={{
                          fontSize: '12px',
                          color: colors.textMuted,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          marginTop: '2px',
                        }}
                      >
                        {item.preview}
                      </div>
                    )}
                  </div>

                  {/* Date */}
                  <div
                    style={{
                      fontSize: '11px',
                      color: colors.textMuted,
                      flexShrink: 0,
                    }}
                  >
                    {formatDate(item.date)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderTop: `1px solid ${colors.cardBorder}`,
          }}
        >
          <div style={{ fontSize: '13px', color: colors.textMuted }}>
            {selectedIds.size > 0 ? `${selectedIds.size} item${selectedIds.size > 1 ? 's' : ''} selected` : 'Select items to add'}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '10px 16px',
                borderRadius: '8px',
                border: `1px solid ${colors.cardBorder}`,
                backgroundColor: colors.btnSecondaryBg,
                color: colors.btnSecondaryText,
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleAddToCanvas}
              disabled={selectedIds.size === 0}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 16px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: selectedIds.size > 0 ? colors.btnPrimaryBg : colors.btnSecondaryBg,
                color: selectedIds.size > 0 ? colors.btnPrimaryText : colors.textMuted,
                fontSize: '13px',
                fontWeight: '500',
                cursor: selectedIds.size > 0 ? 'pointer' : 'not-allowed',
                opacity: selectedIds.size > 0 ? 1 : 0.6,
              }}
            >
              <span>🔒</span>
              Add to Private Workspace
            </button>
          </div>
        </div>

        {/* Privacy note */}
        <div
          style={{
            padding: '12px 20px',
            backgroundColor: colors.cardBg,
            borderTop: `1px solid ${colors.cardBorder}`,
            borderRadius: '0 0 12px 12px',
          }}
        >
          <p
            style={{
              fontSize: '11px',
              color: colors.textMuted,
              textAlign: 'center',
              margin: 0,
            }}
          >
            🔒 Private = Only you can see (encrypted in browser) • Drag outside Private Workspace to share
          </p>
        </div>
      </div>
    </div>
  );
}
