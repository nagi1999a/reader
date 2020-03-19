'use strict';

import React from 'react';
import cx from 'classnames';

const supportedFormats = ['i', 'b', 'sub', 'sup'];
const multiline = true;

function getFormatter(str) {
  let results = supportedFormats.map(format => str.toLowerCase().indexOf('<' + format + '>'));
  results = results.map((offset, idx) => [supportedFormats[idx], offset]);
  results.sort((a, b) => a[1] - b[1]);
  for (let result of results) {
    let format = result[0];
    let offset = result[1];
    if (offset < 0) continue;
    let lastIndex = str.toLowerCase().indexOf('</' + format + '>', offset);
    if (lastIndex >= 0) {
      let parts = [];
      parts.push(str.slice(0, offset));
      parts.push(str.slice(offset + format.length + 2, lastIndex));
      parts.push(str.slice(lastIndex + format.length + 3));
      return {
        format,
        parts
      }
    }
  }
  return null;
}

function walkFormat(parent) {
  let child = parent.firstChild;
  while (child) {
    if (child.nodeType === 3) {
      let text = child.nodeValue;
      let formatter = getFormatter(text);
      if (formatter) {
        let nodes = [];
        nodes.push(document.createTextNode(formatter.parts[0]));
        let midNode = document.createElement(formatter.format);
        midNode.appendChild(document.createTextNode(formatter.parts[1]));
        nodes.push(midNode);
        nodes.push(document.createTextNode(formatter.parts[2]));
        child.replaceWith(...nodes);
        child = midNode;
        
      }
    }
    walkFormat(child);
    child = child.nextSibling;
  }
}

function walkUnformat(parent) {
  let child = parent.firstChild;
  while (child) {
    let name = child.nodeName.toLowerCase();
    if (
      child.nodeType === 1
      && supportedFormats.includes(name)
    ) {
      if (child.innerText.trim().length) {
        let all = [];
        all.push(document.createTextNode('<' + name + '>'));
        all.push(...child.childNodes);
        all.push(document.createTextNode('</' + name + '>'));
        child.replaceWith(...all);
        child = all[0];
      }
    }
    
    walkUnformat(child);
    child = child.nextSibling;
  }
}


function clean(parent) {
  let map = {
    'strong': 'b'
  };
  
  let child = parent.firstChild;
  while (child) {
    if (child.nodeType === 1) {
      for (let el in map) {
        if (child.nodeName.toLowerCase() === el) {
          let children = child.childNodes;
          let aa = document.createElement(map[el]);
          aa.append(...children);
          
          child.replaceWith(aa);
          child = aa;
          continue;
        }
      }
      
      let multilineFormats = multiline ? ['br', 'div'] : [];
      if (!supportedFormats.concat(multilineFormats).includes(child.nodeName.toLowerCase())) {
        let first = child.firstChild;
        let next = child.nextSibling;
        
        child.replaceWith(...child.childNodes);
        if (first) {
          child = first;
        }
        else {
          child = next;
        }
        continue;
      }
      else {
        while (child.attributes.length > 0) {
          child.removeAttribute(child.attributes[0].name);
        }
      }
    }
    else if (child.nodeType === 3) {
      // Keep the text
    }
    else {
      parent.removeChild(child);
    }
    clean(child);
    child = child.nextSibling;
  }
}

var actions = [
  {
    icon: '<b>B</b>',
    title: 'Bold',
    command: 'bold'
  },
  {
    icon: '<i>I</i>',
    title: 'Italic',
    command: 'italic'
  },
  {
    icon: 'X<sub>2</sub>',
    title: 'Subscript',
    command: 'subscript'
  },
  {
    icon: 'X<sup>2</sup>',
    title: 'Superscript',
    command: 'superscript'
  },
  {
    icon: 'T<sub>x</sub>',
    title: 'Superscript',
    command: 'removeformat'
  }
];

class Content extends React.Component {
  currentText = null;
  
  constructor(props) {
    super(props)
  }
  
  componentDidMount() {
    document.addEventListener('selectionchange', this.onSelectionChange);
    this.props.innerRef.current.innerText = this.props.text;
    walkFormat(this.props.innerRef.current);
    this.currentText = this.props.text;
  }
  
  componentWillUnmount() {
    document.removeEventListener('selectionchange', this.onSelectionChange);
  }
  
  componentDidUpdate(prevProps) {
    if (
      this.props.id !== prevProps.id
      || this.currentText !== prevProps.text
    ) {
      this.props.innerRef.current.innerText = this.props.text;
      walkFormat(this.props.innerRef.current);
      this.currentText = this.props.text
    }
  }
  
  onSelectionChange = () => {
    let { onSelectionChange, innerRef } = this.props;
    let selection = window.getSelection();
    
    // let range = null;
    
    // if (selection.isCollapsed) {
    // 	range = selection.getRangeAt(0);
    // }
    
    
    let node = selection.anchorNode;
    
    let found = false;
    do {
      if (node === innerRef.current) {
        found = true;
        break;
      }
    }
    while (node && (node = node.parentNode));
    
    let isSelected = false;
    
    if (!selection.isCollapsed && found) {
      isSelected = true;
    }
    
    onSelectionChange(isSelected);
  }
  
  shouldComponentUpdate(nextProps) {
    if (
      this.props.id !== nextProps.id
      || this.currentText !== nextProps.text
    ) {
      return true;
    }
    return false;
  }
  
  handleChange = (html) => {
    this.refs.renderer.innerHTML = html;
    walkUnformat(this.refs.renderer);
    let text = this.refs.renderer.innerText;
    text = text.replace(/\n<\//g, '<\/');
    text = text.trim();
    this.currentText = text;
    this.props.onChange(text);
  }
  
  render() {
    let { plainTextOnly, text, placeholder, onChange, innerRef, onBlur } = this.props;
    return (
      <React.Fragment>
        <div
          ref={innerRef}
          suppressContentEditableWarning={true}
          className="content"
          contentEditable={!this.props.isReadOnly}
          onInput={() => {
            clean(innerRef.current);
            this.handleChange(innerRef.current.innerHTML);
          }}
          placeholder={placeholder}
          onKeyDown={(event) => {
            event.stopPropagation();
          }}
          onBlur={onBlur}
        />
        <div className="renderer" ref="renderer"></div>
      </React.Fragment>
    );
  }
}

class Editor extends React.Component {
  constructor(props) {
    super(props)
  }
  
  contentRef = React.createRef();
  state = {
    isSelected: false,
    bubbleTop: null
  }
  
  componentDidMount() {
    window.addEventListener('pointerup', this.handleSelection);
  }
  
  getSelectionTop() {
    let selection = window.getSelection();
    if (!selection || selection.isCollapsed) return null;
    let range = selection.getRangeAt(0);
    let selectionRect = range.getBoundingClientRect();
    
    let editorNode = range.startContainer.parentNode.closest('.editor');
    if (editorNode !== this.refs.editor) return null;
    let editorRect = editorNode.getBoundingClientRect();
    return selectionRect.y - editorRect.y;
  }
  
  handleSelection = () => {
    this.setState({ bubbleTop: this.getSelectionTop() });
  }
  
  render() {
    let { plainTextOnly, text, placeholder, id, onChange, onBlur } = this.props;
    plainTextOnly = false;
    return (
      <div ref="editor" className="editor">
        {!plainTextOnly ? (
          <div
            className={cx('bubble', { hidden: this.state.bubbleTop === null })}
            style={{ top: this.state.bubbleTop - 12 }}
          >
            {
              actions.map((action, idx) => (
                <button
                  key={idx}
                  className="button"
                  dangerouslySetInnerHTML={{ __html: action.icon }}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    document.execCommand(action.command, false, null);
                    this.contentRef.current.focus();
                  }}
                />
              ))
            }
          </div>) : null}
        <Content
          id={id}
          text={text}
          onChange={onChange}
          innerRef={this.contentRef}
          isReadOnly={this.props.isReadOnly}
          onSelectionChange={(isSelected) => {
            this.setState({ isSelected });
          }}
          onBlur={onBlur}
          placeholder={placeholder}
        />
      </div>
    );
  }
}

export default Editor;
