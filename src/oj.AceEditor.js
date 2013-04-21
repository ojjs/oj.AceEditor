// Create a plugin by defining a function that accepts oj and
// returns a map of extensions to oj

var debounce;

module.exports = function(oj,settings){
  // Initialize marked options
  if (typeof settings !== 'object')
    settings = {}

  var AceEditor = oj.type('AceEditor', {
    base: oj.ModelKeyView,

    constructor: function(){
      var union = oj.argumentsUnion(arguments);
      var options = union.options;
      var args = union.args;

      // Normally oj.View automatically creates an oj.id for us, but the ace editor
      // is triggered by id so we need a reference to it at this level.
      options.id = options.id || oj.id()

      // Default options
      var defaults = {
        width: '400px',           // Default the height
        height: '200px',          // Default the width
        fontSize: 14,             // Default font size
        showFoldWidgets: false,   // Hide fold widgets
        showPrintMargin: false,   // Hide print margin
        useSoftTabs: true,        // Change tabs to spaces
        behaviorsEnabled: true,   // Enable quote and paren matching
        foldStyle: 'markbegin',   // Default fold style when folds are unhidden

        // Disable workers on local files because ace doesn't support this
        useWorker: window.location.protocol != 'file:'
      };
      // Default options if unspecified
      for (k in defaults) {
        if (options[k] == null)
          options[k] = defaults[k];
      }

      // Create el as relatively positioned div
      this.el = oj.toDOM(function(){
        var input;
        if(args.length > 0)
          input = args.join('\n');
        oj.div(input, {
          style:{
            position:'relative',
            width:options.width,
            height:options.height
          }
        });
      });

      // AceEditor is must be included by <script> tag. Help people understand.
      if(oj.isClient && ace == null)
        throw new Error('oj.AceEditor: `ace` global not found. Include the editor with a <script> tag!');

      // Create editor
      if (oj.isClient && typeof ace != 'undefined') {

        this.editor = ace.edit(this.el);
        this.editor.resize()

        // Register for editor changes
        // Use debounce to ensure cut and paste only fires one event change
        var This = this;
        this.session.doc.on('change', debounce(50, function(){
          if (typeof This.viewChanged == 'function')
            This.viewChanged();
          if (typeof This.change == 'function')
            This.change();
        }));
      }

      // Shift editor properties
      var props = [
        'theme',
        'mode',
        'width',
        'height',
        'wrapLimit',
        'showPrintMargin',
        'readOnly',
        'fontSize',
        'tabSize',

        'foldStyle',
        'selectionStyle',

        'showPrintMargin',
        'showInvisibles',
        'showGutter',
        'showIndentGuides',
        'showFoldWidgets',

        'highlightSelectedWord',
        'highlightActiveLine',

        'useSoftTabs',
        'useWrapMode',
        'wrapLimitRange',
        'printMarginColumn',
        'animatedScroll',
        'useWorker',
        'hScrollBarAlwaysVisible',
        'fadeFoldWidgets',

        'behaviorsEnabled'
      ];
      for (var i = 0; i < props.length; i++) {
        var prop = props[i];
        if (options[prop] != null)
          this[prop] = oj.argumentShift(options, prop);
      }

      // Pass on options. Args have been handled at this level.
      AceEditor.base.constructor.apply(this, [options]);

    },

    properties: {

      // Accessing Properties
      // ----------------------------------------------------------------------

      value: {
        get: function(){ if(this.session) return this.session.getValue(); },
        set: function(v){
          if(this.session) {
            // Save the location of the cursor
            var pos = this.cursorPosition;
            this.session.setValue(v);
            // Restore the location of the cursor
            this.cursorPosition = pos;
          }
        }
      },

      editor: {
        get: function(){ return this._editor; },
        set: function(v){ this._editor = v; }
      },

      session: {
        get: function(){ if(this.editor) return this.editor.getSession(); },
        set: function(v){ if(this.editor) this.editor.setSession(v); }
      },

      renderer: {
        get: function(){ if(this.editor) return this.editor.renderer; }
      },

      change: {
        get: function(){ return this._change; },
        set: function(v){ this._change = v; }
      },

      // Wrap ace event handling object
      eventHandler: {
        get: function(){
          if (typeof 'ace' == 'undefined')
            return;
          return this._eventHandler || (this._eventHandler = ace.require("ace/lib/event"));
        }
      },

      // Wrap ace container element
      containerEl: {
        get: function(){
          return this._container || (this._container = this.$('.editor-container')[0]);
        }
      },

      // Custom Properties
      // ----------------------------------------------------------------------

      // Set/get theme and automatically add ace/theme prefix
      theme: {
        get: function(){
          if (!this.editor) return;
          var theme = this.editor.getTheme();
          var prefix = 'ace/theme/';
          if (theme && theme.indexOf(prefix) === 0)
            theme = theme.slice(prefix.length);
          return theme;
        },
        set: function(v){
          if (!this.editor) return;
          var prefix = 'ace/theme/';
          if (v && v.indexOf(prefix) != 0)
            v = prefix + v;
          this.editor.setTheme(v);
        }
      },

      // Set/get mode and automatically add ace/mode prefix
      mode: {
        get: function(){
          if (!this.session) return;
          // Get mode string from Mode object
          var mode = this.session.getMode().$id;
          var prefix = 'ace/mode/';
          if (mode && mode.indexOf(prefix) === 0)
            mode = mode.slice(prefix.length);
          return mode;
        },
        set: function(v){
          if (!this.session) return;
          var prefix = 'ace/mode/';
          if (v && v.indexOf(prefix) != 0)
            v = prefix + v;
          this.session.setMode(v);
        }
      },

      // Change width
      width: {
        get: function(){ this.$el.css('width'); },
        set: function(v){
          this.$el.css('width', v);
          if (this.editor)
            this.editor.resize();
        }
      },

      // Change height
      height: {
        get: function(){ this.$el.css('height'); },
        set: function(v){
          this.$el.css('height', v);
          if (this.editor)
            this.editor.resize();
        }
      },

      // Meta property that sets wrapLimitRange, printMarginColumn, and useWrapMode all at once
      // wrapLimit: 40      (limit of 40 characters)
      // wrapLimit: 'off'   (no limit, creates scroll bar)
      // wrapLimit: 'auto'  (limit to size of buffer)
      wrapLimit: {
        get: function(){ if(this.session) return this.wrapLimitRange; },
        set: function(v){
          if(this.session) {
            // Turn off wrapping if false or set to 'off'
            if(!v || v === 'off') {
              this.useWrapMode = false;
              this.printMarginColumn = 80;
            }

            // Wrap to region if set to 'auto'
            else if (v === 'auto') {
              this.useWrapMode = true;
              this.wrapLimitRange = null;
              this.printMarginColumn = 80;
            }

            // Otherwise wrap to specified character count
            else if (typeof v === 'number') {
              this.wrapLimitRange = v;
              this.printMarginColumn = v;
              this.useWrapMode = true;
            }
          }
        }
      },

      // TODO: Enable Drag and drop as a property
      // useDragAndDrop: {
      //   get: function(){},
      //   set: function(v){}
      // },
      // https://github.com/ajaxorg/ace/blob/master/demo/kitchen-sink/demo.js#L437
      // event.addListener(container, "drop", function(e) {
      //   var file;
      //   try {
      //       file = e.dataTransfer.files[0];
      //       if (window.FileReader) {
      //           var reader = new FileReader();
      //           reader.onload = function() {
      //               var mode = modelist.getModeFromPath(file.name);

      //               env.editor.session.doc.setValue(reader.result);
      //               modeEl.value = mode.name;
      //               env.editor.session.setMode(mode.mode);
      //               env.editor.session.modeName = mode.name;
      //           };
      //           reader.readAsText(file);
      //       }
      //       return event.preventDefault(e);
      //   } catch(err) {
      //       return event.stopEvent(e);
      //   }
      // });

      // Editor Configuration Properties
      // ----------------------------------------------------------------------

      // Make the editor read only
      readOnly: {
        get: function(){ if(this.editor) return this.editor.getReadOnly(); },
        set: function(v){ if(this.editor) this.editor.setReadOnly(v); }
      },

      // Change font size
      fontSize: {
        get: function(){ if(this.editor) return this._fontSize; },
        set: function(v){
          if(this.editor) {
            this.editor.setFontSize(v);
            this._fontSize = v;
          }
        }
      },

      // Change tab size
      tabSize: {
        get: function(){ if(this.editor) return this.session.getTabSize(); },
        set: function(v){ if(this.editor) this.session.setTabSize(v); }
      },

      // Change cursorPosition as object: {row:4, column:25}
      cursorPosition: {
        get: function(){ if(this.editor) return this.editor.getCursorPosition(); },
        set: function(v){ if(this.editor) this.editor.moveCursorToPosition(v); }
      },

      // Editor Show Properties
      // ----------------------------------------------------------------------

      // Show print margin
      showPrintMargin: {
        get: function(){ if(this.editor) return this.editor.getShowPrintMargin(); },
        set: function(v){ if(this.editor) this.editor.setShowPrintMargin(v); }
      },

      // Show invisible characters
      showInvisibles: {
        get: function(){ if(this.editor) return this.editor.getShowInvisibles(); },
        set: function(v){ if(this.editor) this.editor.setShowInvisibles(v); }
      },

      // Show gutter
      showGutter: {
        get: function(){ if(this.editor) return this.renderer.getShowGutter(); },
        set: function(v){ if(this.editor) this.renderer.setShowGutter(v); }
      },

      // Show Indent guides
      showIndentGuides: {
        get: function(){ if(this.editor) return this.editor.getDisplayIndentGuides(); },
        set: function(v){ if(this.editor) this.editor.setDisplayIndentGuides(v); }
      },

      // Show fold widgets that collapse / expand code blocks
      showFoldWidgets: {
        get: function(){ if(this.editor) return this.editor.getShowFoldWidgets(); },
        set: function(v){ if(this.editor) this.editor.setShowFoldWidgets(v); }
      },

      // Editor Highlight Properties
      // ----------------------------------------------------------------------

      // Highlight selected word elsewhere in the editor
      highlightSelectedWord: {
        get: function(){ if(this.editor) return this.editor.getHighlightSelectedWord(); },
        set: function(v){ if(this.editor) this.editor.setHighlightSelectedWord(v); }
      },

      // Highlight active line
      highlightActiveLine: {
        get: function(){ if(this.editor) return this.editor.getHighlightActiveLine(); },
        set: function(v){ if(this.editor) this.editor.setHighlightActiveLine(v); }
      },

      // Editor Style Properties
      // ----------------------------------------------------------------------

      // Selection style options: 'line' or 'text'
      selectionStyle: {
        get: function(){ if(this.editor) return this.editor.getSelectionStyle(); },
        set: function(v){ if(this.editor) this.editor.setSelectionStyle(v); }
      },

      // Fold style options: 'manual', markbegin' or 'markbeginend'
      foldStyle: {
        get: function(){ if(this.session) return this._foldStyle; },
        set: function(v){
          if(this.session) {
            this._foldStyle = v;
            this.session.setFoldStyle(v);
          }
        }
      },

      // Enable ace editor behaviors to auto match quotes, parens, curly braces, and square brackets
      behaviorsEnabled: {
        get: function(){ if(this.editor) return this.editor.getBehavioursEnabled(); },
        set: function(v){ if(this.editor) this.editor.setBehavioursEnabled(v); }
      },

      // Editor Not-Very-Important Properties
      // ----------------------------------------------------------------------------------

      useSoftTabs: {
        get: function(){ if(this.session) return this.session.getUseSoftTabs(); },
        set: function(v){ if(this.session) this.session.setUseSoftTabs(v); }
      },

      // Set whether wrapping should be on (true) or off (false)
      useWrapMode: {
        get: function(){ if(this.session) return this.session.getUseWrapMode(); },
        set: function(v){ if(this.session) this.session.setUseWrapMode(v); }
      },

      // Set the wrap limit character count
      wrapLimitRange: {
        get: function(){ if(this.session) return this.session.getWrapLimitRange(); },
        set: function(v){ if(this.session) this.session.setWrapLimitRange(v, v); },
      },

      // Set the number of characters the margin should appear at.
      printMarginColumn: {
        get: function(){ if(this.renderer) return this.renderer.getPrintMarginColumn(); },
        set: function(v){ if(this.renderer) this.renderer.setPrintMarginColumn(v); }
      },

      // Animates scrolling for find and goto line
      animatedScroll: {
        get: function(){ if(this.editor) return this.editor.getAnimatedScroll(); },
        set: function(v){ if(this.editor) this.editor.setAnimatedScroll(v); }
      },

      // Use or disable worker threads in ace editor
      useWorker: {
        get: function(){ if(this.session) return this.session.getUseWorker(); },
        set: function(v){ if(this.session) this.session.setUseWorker(v); }
      },

      // Turn horizontal scrollbar on permanently
      hScrollBarAlwaysVisible: {
        get: function(){ if(this.editor) return this.renderer.getHScrollBarAlwaysVisible(); },
        set: function(v){ if(this.editor) this.renderer.setHScrollBarAlwaysVisible(v); }
      },

      // Fade fold widgets that allow code blocks to be collapsed
      fadeFoldWidgets: {
        get: function(){ if(this.editor) return this.editor.getFadeFoldWidgets(); },
        set: function(v){ if(this.editor) this.editor.setFadeFoldWidgets(v); }
      }

    },

    methods: {
    }
  });

  // oj.markdown
  return {AceEditor:AceEditor};

};

// Debounce from underscore to remove the only underscore dependency
// http://underscorejs.org/#debounce
debounce = function(wait, func, immediate) {
  var timeout, result;
  return function() {
    var context = this, args = arguments;
    var later = function() {
      timeout = null;
      if (!immediate) result = func.apply(context, args);
    };
    var callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) result = func.apply(context, args);
    return result;
  };
};