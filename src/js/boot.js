/* starts empty: no origin / destination selected */
setDefaultTime(); syncLive(); $('results').innerHTML = EMPTY;
if (matchMedia('(max-width:899px)').matches) setPane('plan');
if (TILES) { trInitUI(); catInit(); $('lyrkeysave').onclick = () => { const v = $('lyrkey').value.trim(); if (!v) return; longdoKey = v; try { localStorage.setItem('rail-longdo', v); } catch (e) {} tstyle = 'longdo'; $('mapstyle').value = 'longdo'; try { localStorage.setItem('rail-tiles6', 'longdo'); } catch (e) {} $('lyr').hidden = true; draw(); }; }
else { $('lyrbtn').hidden = true; $('catbtn').hidden = true; $('modes').hidden = true; }
