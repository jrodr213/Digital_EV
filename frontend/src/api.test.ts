import {describe,it,expect,vi,afterEach} from 'vitest';
import {api,fmt} from './api';
describe('engineering presentation',()=>{
 it('leaves missing and nonfinite results unavailable',()=>{expect(fmt(null)).toBe('—');expect(fmt(undefined)).toBe('—');expect(fmt(NaN)).toBe('—');expect(fmt(0)).toBe('0')});
 it('formats engineering precision',()=>expect(fmt(26.8224,2)).toBe('26.82'));
});
describe('API boundary',()=>{
 afterEach(()=>vi.unstubAllGlobals());
 it('sends configurations as JSON',async()=>{const request=vi.fn().mockResolvedValue({ok:true,json:async()=>({id:'saved'})});vi.stubGlobal('fetch',request);expect(await api('/vehicles',{name:'Test'})).toEqual({id:'saved'});expect(request.mock.calls[0][0]).toBe('/api/vehicles');expect(request.mock.calls[0][1].body).toBe('{"name":"Test"}')});
 it('surfaces simulation failures without making up results',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,json:async()=>({detail:'FASTSim failed'})}));await expect(api('/runs',{})).rejects.toThrow('FASTSim failed')});
});
