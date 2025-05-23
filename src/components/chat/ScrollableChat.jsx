import { useState, useEffect, useRef } from "react";
import ScrollableFeed from "react-scrollable-feed";
import {
  isLastMessage,
  isSameSender,
  isSameSenderMargin,
  isSameUser,
} from "./config/ChatLogics";

import axios from "axios";

const ScrollableChat = ({ messages, onMessageDeleted }) => {
  const [user, setUser] = useState();
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [localMessages, setLocalMessages] = useState(messages);
  const [deleteResponse, setDeleteResponse] = useState(null);
  const [showResponse, setShowResponse] = useState(false);
  // Track deleted message IDs
  const [deletedMessageIds, setDeletedMessageIds] = useState({});

  // Update local messages when the prop changes, but preserve deleted message status
  useEffect(() => {
    if (!messages) return;
    
    // Map through incoming messages and replace content for deleted ones
    const updatedMessages = messages.map(message => {
      if (deletedMessageIds[message._id]) {
        return { ...message, content: "This message was deleted" };
      }
      return message;
    });
    
    setLocalMessages(updatedMessages);
  }, [messages, deletedMessageIds]);

  useEffect(() => {
    const userInfo = JSON.parse(localStorage.getItem("userInfo"));
    setUser(userInfo);
  }, []);

  // Check if a message is deleted
  const isDeletedMessage = (message) => {
    return message.content === "This message was deleted" || deletedMessageIds[message._id];
  };

  const handleDeleteClick = (message) => {
    // Only enable deletion for user's own messages that are not already deleted
    if (message.sender._id !== user?._id || isDeletedMessage(message)) return;
    
    setSelectedMessage(message);
    setShowDeleteConfirm(true);
  };

  const handleDeleteMessage = async () => {
    if (!selectedMessage) return;
    
    try {
      const response = await axios.post("https://e-college-data.onrender.com/v1/chat/delete-message", {
        messageId: selectedMessage._id,
        ownId: user._id,
      });
  
      if (response) {
        setShowDeleteConfirm(false);
        
        // Display response data
        setDeleteResponse(response.data);
        setShowResponse(true);
        
        // Auto-hide response after 3 seconds
        setTimeout(() => {
          setShowResponse(false);
          setDeleteResponse(null);
        }, 3000);
        
        // Update the deletedMessageIds state
        setDeletedMessageIds(prev => ({
          ...prev,
          [selectedMessage._id]: true
        }));
        
        // Update the local state to reflect deletion
        const updatedMessages = localMessages.map(m => 
          m._id === selectedMessage._id 
            ? { ...m, content: "This message was deleted" }
            : m
        );
        
        setLocalMessages(updatedMessages);
        setSelectedMessage(null);
        
        // Notify parent component about deletion if callback exists
        if (typeof onMessageDeleted === 'function') {
          onMessageDeleted(selectedMessage._id);
        }
      } else {
        console.error("Failed to delete message");
        alert("Failed to delete message");
      }
    } catch (error) {
      console.error("Error deleting message:", error);
      setDeleteResponse({ error: "Error deleting message. Please try again." });
      setShowResponse(true);
      
      // Auto-hide error after 3 seconds
      setTimeout(() => {
        setShowResponse(false);
        setDeleteResponse(null);
      }, 3000);
    }
  };

  const formatTimestamp = (isoString) => {
    const messageDate = new Date(isoString);
    const indiaDate = new Date(
      messageDate.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    );
    const now = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    );

    const hours = indiaDate.getHours() % 12 || 12;
    const minutes = indiaDate.getMinutes().toString().padStart(2, "0");
    const ampm = indiaDate.getHours() >= 12 ? "PM" : "AM";
    const timeStr = `${hours}:${minutes} ${ampm}`;

    const isSameDay =
      indiaDate.getDate() === now.getDate() &&
      indiaDate.getMonth() === now.getMonth() &&
      indiaDate.getFullYear() === now.getFullYear();

    const diffInMs = now.getTime() - indiaDate.getTime();
    const diffInHours = diffInMs / (1000 * 60 * 60);

    if (isSameDay || diffInHours < 24) {
      return timeStr;
    }

    const dateStr = indiaDate.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    return `${dateStr} | ${timeStr}`;
  };

  const isValidUrl = (text) => {
    try {
      const url = new URL(text);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch (_) {
      return false;
    }
  };

  const isImageUrl = (text) => {
    if (!text || typeof text !== 'string') return false;
    if (text.startsWith('Image:')) {
      const url = text.substring(6).trim();
      return isValidUrl(url);
    }
    return false;
  };

  const isPdfUrl = (text) => {
    if (!text || typeof text !== 'string') return false;
    if (text.startsWith('PDF ') || text.startsWith('PDF:')) {
      return true;
    }
    return false;
  };

  // Extract PDF name and URL from the content
  const extractPdfInfo = (content) => {
    let pdfName = "document.pdf";
    let pdfUrl = "";
    
    if (content.startsWith('PDF ')) {
      const colonIndex = content.indexOf(':');
      if (colonIndex > 4) {
        pdfName = content.substring(4, colonIndex).trim();
        pdfUrl = content.substring(colonIndex + 1).trim();
      }
    } 
    // For format: "PDF: https://example.com/file.pdf"
    else if (content.startsWith('PDF:')) {
      pdfUrl = content.substring(4).trim();
    }
    
    return { pdfName, pdfUrl };
  };

  // Function to download PDF with proper headers
  const downloadPdf = (url, filename = "document.pdf") => {
    fetch(url)
      .then(response => response.blob())
      .then(blob => {
        // Create blob link to download
        const blobUrl = window.URL.createObjectURL(
          new Blob([blob], { type: 'application/pdf' })
        );
        
        // Create temporary link
        const link = document.createElement('a');
        link.href = blobUrl;
        link.setAttribute('download', filename);
        
        // Append to html page
        document.body.appendChild(link);
        
        // Force download
        link.click();
        
        // Clean up and remove the link
        link.parentNode.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      })
      .catch(error => {
        console.error('Error downloading PDF:', error);
        alert('Failed to download PDF. Please try again.');
      });
  };

  const openFullscreenImage = (imageUrl) => {
    setFullscreenImage(imageUrl);
    // Prevent body scrolling when modal is open
    document.body.style.overflow = 'hidden';
  };

  const closeFullscreenImage = () => {
    setFullscreenImage(null);
    // Restore body scrolling
    document.body.style.overflow = 'auto';
  };

  const renderContent = (content) => {
    if (isImageUrl(content)) {
      const imageUrl = content.substring(6).trim();
      return (
        <div 
          className="message-image-container w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 overflow-hidden bg-gray-100 flex items-center justify-center rounded-md cursor-pointer"
          onClick={() => openFullscreenImage(imageUrl)}
        >
          <img 
            src={imageUrl} 
            alt="Image preview" 
            className="max-w-full max-h-full object-contain"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = "https://via.placeholder.com/200x200?text=Image+Failed+to+Load";
            }}
          />
        </div>
      );
    } else if (isPdfUrl(content)) {
      const { pdfName, pdfUrl } = extractPdfInfo(content);
      const truncatedName = pdfName.length > 20 ? pdfName.substring(0, 18) + '...' : pdfName;
      
      return (
        <div className="flex flex-col items-start p-2 sm:p-3 border rounded-md bg-gray-50 w-full">
          <div className="flex items-center w-full">
            <svg className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-red-600 mr-1 sm:mr-2 flex-shrink-0" fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512">
              <path d="M320 464C328.8 464 336 456.8 336 448V416H384V368C384 359.2 376.8 352 368 352H336V320H384V272C384 263.2 376.8 256 368 256H336V224H384V176C384 167.2 376.8 160 368 160H336V128H384V80C384 71.16 376.8 64 368 64H336V32C336 23.16 328.8 16 320 16C311.2 16 304 23.16 304 32V64H272V16C272 7.164 264.8 0 256 0H224V32H192V0H144C135.2 0 128 7.164 128 16V32H96V0H48C39.16 0 32 7.164 32 16V64H0V112H32V144H0V192H32V224H0V272H32V304H0V352H32V384H0V432C0 440.8 7.164 448 16 448H64V480C64 488.8 71.16 496 80 496H128V464H160V496H208V464H240V496H288V464H320z"/>
            </svg>
            <span className="text-xs sm:text-sm font-medium truncate flex-grow" title={pdfName}>
              {truncatedName}
            </span>
          </div>
          
          <div className="flex w-full mt-1 sm:mt-2">
            <button
              onClick={() => downloadPdf(pdfUrl, pdfName)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-1 px-2 sm:px-3 rounded text-xs font-medium transition-colors"
            >
              Download PDF
            </button>
          </div>
        </div>
      );
    } else if (isValidUrl(content)) {
      return (
        <a
          href={content}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 underline break-all hover:text-blue-800"
        >
          {content}
        </a>
      );
    } else if (content === "This message was deleted") {
      return (
        <div className="flex items-center justify-center text-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          <span className="italic text-gray-400 text-xs sm:text-sm font-light">This message was deleted</span>
        </div>
      );
    } else {
      return content;
    }
  };

  return (
    <>
      <ScrollableFeed className="px-2 sm:px-3 md:px-4 lg:px-6 scrollable-feed">
        {localMessages &&
          localMessages.map((m, i) => {
            const isMine = m.sender._id === user?._id;
            const showSenderInfo = !isSameUser(localMessages, m, i, user?._id) && !isMine;
            const isConsecutiveMessage = isSameUser(localMessages, m, i, user?._id);
            const isSpecialContent = isImageUrl(m.content) || isPdfUrl(m.content);
            const isDeleted = isDeletedMessage(m);
            const canDelete = isMine && !isDeleted;

            return (
              <div className="flex flex-col w-full" key={m._id}>
                <div
                  className={`flex ${
                    isMine ? "justify-end" : "justify-start"
                  } w-full ${
                    isConsecutiveMessage ? "mt-1" : "mt-2 sm:mt-3"
                  }`}
                >
                  {!isMine && (
                    <div className={`flex-shrink-0 ${showSenderInfo ? "visible" : "invisible"}`}>
                      <img
                        className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 rounded-full object-cover mt-1 mr-1 sm:mr-2"
                        src={
                          m.sender.pic ||
                          `https://ui-avatars.com/api/?name=${encodeURIComponent(m.sender.name)}`
                        }
                        alt={m.sender.name}
                      />
                    </div>
                  )}

                  <div
                    className={`flex flex-col relative ${
                      isSpecialContent 
                        ? "max-w-[85%] sm:max-w-[75%] md:max-w-[70%] lg:max-w-[60%]" 
                        : "max-w-[75%] sm:max-w-[70%] md:max-w-[60%] lg:max-w-[50%]"
                    } shadow-md ${
                      isMine
                        ? `${isDeleted ? "bg-gray-100" : "bg-blue-100"} text-gray-800 rounded-t-2xl rounded-bl-2xl rounded-br-md`
                        : `${isDeleted ? "bg-gray-100" : "bg-green-100"} text-gray-800 rounded-t-2xl rounded-br-2xl rounded-bl-md`
                    } ${showSenderInfo ? "" : isMine ? "rounded-tr-md" : "rounded-tl-md"}`}
                  >
                    {/* Vertical triple dot menu for user's own messages that aren't deleted */}
                    {canDelete && (
                      <button 
                        onClick={() => handleDeleteClick(m)}
                        className="absolute top-1 right-1 w-6 h-6 rounded-full hover:bg-gray-200 flex items-center justify-center transition-colors z-10"
                        aria-label="Message options"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-600" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                        </svg>
                      </button>
                    )}
                    
                    {!isMine && showSenderInfo && (
                      <div className="px-2 sm:px-3 pt-1 sm:pt-2 pb-1 border-b border-green-200">
                        <span className="block text-xs md:text-sm font-semibold text-purple-800">
                          {m.sender.name}
                        </span>
                        <span className="block text-[6px] sm:text-[8px] md:text-xs text-gray-500">
                          {m.sender.email}
                        </span>
                      </div>
                    )}

                    <div className={`
                      px-2 py-1 sm:px-3 sm:py-2 text-xs md:text-sm
                      ${isSpecialContent ? 'p-1 sm:p-2' : ''}
                      ${canDelete ? 'pr-8 md:pr-10' : ''} 
                    `}>
                      <div className={`break-words block max-h-[200px] sm:max-h-[250px] overflow-auto custom-scroll ${isDeleted ? 'py-1' : ''}`}>
                        {renderContent(m.content)}
                      </div>
                     
                      <span className="text-[8px] sm:text-[10px] text-gray-500 block text-right mt-1">
                        {formatTimestamp(m.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
      </ScrollableFeed>

      {/* API Response Toast Notification */}
      {showResponse && deleteResponse && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-700 text-white px-4 py-2 rounded-lg shadow-lg z-50 text-sm">
          {deleteResponse.error ? (
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span>{deleteResponse.error}</span>
            </div>
          ) : (
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>{deleteResponse.message || "Message deleted successfully"}</span>
            </div>
          )}
        </div>
      )}

      {/* Fullscreen Image Modal */}
      {fullscreenImage && (
        <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="relative w-full h-full flex flex-col items-center justify-center">
            {/* Close button */}
            <button 
              onClick={closeFullscreenImage}
              className="absolute top-4 right-4 sm:top-6 sm:right-6 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full p-2 shadow-lg transition-colors z-10"
              aria-label="Close fullscreen image"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 sm:h-8 sm:w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            {/* Image container with pinch-zoom capabilities */}
            <div className="w-full h-full flex items-center justify-center overflow-hidden">
              <img 
                src={fullscreenImage} 
                alt="Fullscreen view" 
                className="max-w-full max-h-full object-contain"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = "https://via.placeholder.com/800x600?text=Image+Failed+to+Load";
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-xs sm:max-w-sm md:max-w-md p-4 sm:p-6">
            <h3 className="text-lg sm:text-xl font-medium text-gray-900 mb-2 sm:mb-3">Delete Message</h3>
            <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">Are you sure you want to delete this message? This action cannot be undone.</p>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setSelectedMessage(null);
                }}
                className="px-3 py-2 sm:px-4 sm:py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs sm:text-sm font-medium rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteMessage}
                className="px-3 py-2 sm:px-4 sm:py-2 bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-medium rounded-md transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ScrollableChat;